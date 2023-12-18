import { KisRequest, KisResponse } from '@shared/apis/kis';
import { useEffect, useState, useRef } from 'react';

export type KisApiFunction<T, B, R> = (request:KisRequest<T, B>)=>Promise<KisResponse<R>|undefined>;

export interface ApiOption<T, B, R> {
  request?:KisRequest<T, B>;
  retryWhenSessionOut?:boolean;
  callback?:(result?:KisResponse<R>)=>void;
  useCache?:boolean;
}

const resultCacheMap = new Map<KisApiFunction<never, never, unknown>, Map<string, unknown>>();
function getCacheMap(func:KisApiFunction<never, never, unknown>) {
  let map = resultCacheMap.get(func);
  if (!map) {
    map = new Map();
    resultCacheMap.set(func, map);
  }
  return map;
}

export function useKisApi<T, B, R>(func:KisApiFunction<T, B, R>, option?:ApiOption<T, B, R>) {
  const [ result, setResult ] = useState<R>();
  const [ retrySwitch, setRetrySwitch ] = useState(false);

  const retrySwitchRef = useRef(retrySwitch);
  const retryCount = useRef(0);

  useEffect(() => {
    // cache 체크
    if (option?.useCache) {
      const cacheMap = getCacheMap(func);
      const key = JSON.stringify(option?.request);
      const cachedValue = cacheMap.get(key) as KisResponse<R> | undefined;
      if (cachedValue) {
        setResult(cachedValue?.output);
        option?.callback && option?.callback(cachedValue);

        // switch update
        retrySwitchRef.current = retrySwitch;
        return;
      }
    }

    // api call
    func(option?.request || {}).then((data) => {
      // result
      setResult(data?.output);

      // cache
      if (option?.useCache) {
        const cacheMap = getCacheMap(func);
        const key = JSON.stringify(option?.request);
        cacheMap.set(key, data);
      }

      // callback
      option?.callback && option?.callback(data);
    }).catch((error) => {
      // session retry
      if (option?.retryWhenSessionOut !== false && error?.response?.data?.rt_cd === 'nosession') {
        if (retryCount.current > 5) {
          throw new Error(`Retry Count Exceeded ${retryCount}`);
        }
        retryCount.current += 1;
        setTimeout(() => setRetrySwitch(!retrySwitch), 500);
        return Promise.resolve(error.response.data);
      }
      return Promise.reject(error);
    });

    // switch update
    retrySwitchRef.current = retrySwitch;
  }, [ func, retrySwitch ]);

  const refresh = () => {
    setRetrySwitch(!retrySwitchRef.current);
  };

  const clearCache = () => {
    resultCacheMap.clear();
  };

  return [ result, setResult, refresh, clearCache ] as [typeof result, typeof setResult, typeof refresh, typeof clearCache];
}