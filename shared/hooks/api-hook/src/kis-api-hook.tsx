import { KisRequest, KisResponse } from '@shared/apis/kis';
import { useEffect, useState, useRef } from 'react';

export interface ApiOption<T, B, R> {
  request?:KisRequest<T, B>;
  retryWhenSessionOut?:boolean;
  callback?:(result?:KisResponse<R>)=>void;
}
export function useKisApi<T, B, R>(func:(request:KisRequest<T, B>)=>Promise<KisResponse<R>|undefined>, option?:ApiOption<T, B, R>) {
  const [ result, setResult ] = useState<R>();
  const [ retrySwitch, setRetrySwitch ] = useState(false);

  const retrySwitchRef = useRef(retrySwitch);
  const retryCount = useRef(0);

  useEffect(() => {
    func(option?.request || {}).then((data) => {
      setResult(data?.output);
      option?.callback && option?.callback(data);
    }).catch((error) => {
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

    retrySwitchRef.current = retrySwitch;
  }, [ func, retrySwitch ]);

  const refresh = () => {
    setRetrySwitch(!retrySwitchRef.current);
  };

  return [ result, setResult, refresh ] as [typeof result, typeof setResult, typeof refresh];
}