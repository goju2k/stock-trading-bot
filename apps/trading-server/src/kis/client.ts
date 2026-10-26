import axios, { AxiosHeaders, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { KisEnvName, getKisEnvConfig } from './env';
import { scheduleKisRequest } from './request-queue';
import { KisResponseBase } from './types';
import { getStoredToken, saveToken } from './token-store';

// 유효하지 않은/기간만료 token 응답 코드 (browser-side axios-instance.ts와 동일)
const REFRESH_ERROR_CODES = [ 'EGW00121', 'EGW00123' ];

// 초당 거래건수 초과 (KIS 공식 에러코드, 확인된 것만 - 더 있을 수 있음) - request-queue.ts로
// 페이싱을 해도 계정 공유/순간 버스트 등으로 여전히 뚫릴 수 있어서 마지막 방어선으로 재시도한다.
// 2026-08-03 사고로 EGW00215("원장에서 허용 가능한 초당 거래건수를 초과하였습니다")도 여기
// 추가됨 - EGW00201만 막아뒀었는데 실제로 발생한 건 이 코드였다.
const RATE_LIMIT_ERROR_CODES = [ 'EGW00201', 'EGW00215' ];
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_RETRY_DELAY_MS = 500;

// HTTP 응답 자체를 못 받은 순수 네트워크 에러(소켓 리셋 등) - 2026-08-05 확인. KIS가 부하 상황에서
// rt_cd 에러 대신 연결을 그냥 끊어버리는 것으로 보여 레이트리밋과 같은 원인일 가능성이 크다.
const NETWORK_RETRY_CODES = [ 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EPIPE' ];

export class KisApiError extends Error {

  constructor(readonly msgCd: string, message: string) {
    super(message);
  }

}

// KIS는 레이트리밋을 포함한 대부분의 업무 에러를 HTTP 200 + rt_cd:'1' body로 돌려준다
// (HTTP 레벨 에러가 아니다). 이 경우 axios는 "성공"으로 처리하므로 response interceptor의
// 에러(reject) 핸들러는 절대 안 탄다 - 응답 바디를 직접 읽는 호출부(inquireBalance 등)가
// rt_cd를 확인 안 하고 output만 읽으면, 실패를 "빈 결과"로 오인하게 된다
// (2026-08-03 사고: 레이트리밋으로 잔고가 빈 배열처럼 보여서 보유종목 전체가 "매도됨"으로 오판됨).
// 조회 계열 함수는 응답을 쓰기 전에 이 함수로 반드시 검증할 것.
export function assertKisSuccess(data: KisResponseBase) {
  if (data.rt_cd !== '0') {
    throw new KisApiError(data.msg_cd, data.msg1);
  }
}

// env별로 따로 캐싱한다 (real 전용 호출이 있어서 - 개장일 조회는 항상 real로 나가지만
// 거래 모드는 paper일 수 있음. 한 프로세스 안에서 두 env 클라이언트가 동시에 존재할 수 있다).
// 인스턴스는 기본 헤더에 토큰을 박아두기 때문에 그 토큰의 만료시각을 같이 들고 있어야 한다 -
// 2026-10-26 사고: 만료 확인 없이 캐시를 재사용해서, 하루 한 번(09:00 chk-holiday)만 쓰이는
// real 클라이언트가 매 영업일 전날 토큰(24시간 경과)으로 나가 EGW00123으로 실패했다.
interface IssuedToken {
  accessToken: string;
  expiresAt: Date;
}

interface CachedClient {
  instance: AxiosInstance;
  expiresAt: Date;
}
const cachedClients = new Map<KisEnvName, CachedClient>();

// 동시에 여러 요청이 만료 응답을 받아도 토큰은 한 번만 재발급한다 (KIS는 토큰 발급 빈도도 제한함).
const pendingRefreshes = new Map<KisEnvName, Promise<IssuedToken>>();

async function issueToken(envOverride?: KisEnvName): Promise<IssuedToken> {
  const { env, host, appKey, appSecret } = getKisEnvConfig(envOverride);
  const { data } = await axios.post(`${host}/oauth2/tokenP`, {
    grant_type: 'client_credentials',
    appkey: appKey,
    appsecret: appSecret,
  });

  // KIS 토큰 만료(expires_in, 초)보다 5분 일찍 만료 처리해서 경계에서 API가 실패하지 않도록 여유를 둔다.
  const expiresAt = new Date(Date.now() + (Number(data.expires_in) - 300) * 1000);
  await saveToken(env, data.access_token, expiresAt);

  console.log(`[kis:${env}] token issued, expires ${expiresAt.toISOString()}`);
  return { accessToken: data.access_token as string, expiresAt };
}

async function resolveAccessToken(envOverride?: KisEnvName): Promise<IssuedToken> {
  const { env } = getKisEnvConfig(envOverride);
  const stored = await getStoredToken(env);
  if (stored && stored.expiresAt.getTime() > Date.now()) {
    return { accessToken: stored.accessToken, expiresAt: stored.expiresAt };
  }
  return issueToken(envOverride);
}

// 강제 재발급 (토큰 만료 응답 감지시 axios interceptor에서 호출). 캐시된 인스턴스를 버려서
// 다음 getKisClient()가 새 토큰으로 인스턴스를 다시 만들게 한다.
export async function refreshKisToken(envOverride?: KisEnvName): Promise<string> {
  const { env } = getKisEnvConfig(envOverride);
  let pending = pendingRefreshes.get(env);
  if (!pending) {
    pending = issueToken(envOverride).finally(() => pendingRefreshes.delete(env));
    pendingRefreshes.set(env, pending);
  }
  const { accessToken } = await pending;
  cachedClients.delete(env);
  return accessToken;
}

// envOverride 없으면 현재 거래 모드(KIS_ENV)를 쓴다. 개장일 조회처럼 거래 모드와 무관하게
// 항상 특정 env로 호출해야 하는 곳(quotations.ts의 fetchBusinessDay)만 명시적으로 넘긴다.
export async function getKisClient(envOverride?: KisEnvName): Promise<AxiosInstance> {
  const { env, host, appKey, appSecret } = getKisEnvConfig(envOverride);

  const existing = cachedClients.get(env);
  if (existing && existing.expiresAt.getTime() > Date.now()) {
    return existing.instance;
  }

  const { accessToken, expiresAt } = await resolveAccessToken(envOverride);

  const instance = axios.create({
    baseURL: host,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      appkey: appKey,
      appsecret: appSecret,
      Authorization: `Bearer ${accessToken}`,
      custtype: 'P',
    },
  });

  // 모든 요청을 env별 request-queue를 통과시켜 최소 간격을 강제한다 (kis/request-queue.ts).
  instance.interceptors.request.use((config) => scheduleKisRequest(env, async () => config));

  // 재시도 카운트를 요청 config 위에 얹어서(요청당 최대 RATE_LIMIT_MAX_RETRIES회, 레이트리밋과
  // 네트워크 에러가 같은 예산을 공유) 재발송한다 - 원인만 다를 뿐 대응(짧은 backoff 후 재요청)은 동일.
  async function retryRequest(config: Parameters<typeof instance.request>[0], label: string) {
    const retryCount = ((config as { _kisRetryCount?: number; })._kisRetryCount ?? 0) + 1;
    if (retryCount > RATE_LIMIT_MAX_RETRIES) {
      return null;
    }
    console.warn(`[kis:${env}] ${label}, retry ${retryCount}/${RATE_LIMIT_MAX_RETRIES}`);
    (config as { _kisRetryCount?: number; })._kisRetryCount = retryCount;
    await new Promise((resolve) => { setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS * retryCount); });
    return instance.request(config);
  }

  async function retryIfRateLimited(msgCd: string | undefined, config: Parameters<typeof instance.request>[0]) {
    if (!msgCd || !RATE_LIMIT_ERROR_CODES.includes(msgCd)) {
      return null;
    }
    return retryRequest(config, `rate limited (${msgCd})`);
  }

  instance.interceptors.response.use(
    // KIS는 레이트리밋을 포함한 대부분의 에러를 HTTP 200 + rt_cd:'1' body로 돌려주기 때문에
    // "성공" 분기에서도 반드시 확인해야 한다 (client.ts 상단 assertKisSuccess 주석 참고).
    async (res) => (await retryIfRateLimited(res.data?.msg_cd, res.config)) ?? res,
    async (error) => {
      const errCd = error?.response?.data?.msg_cd;

      // 토큰 만료/무효 - 재발급 후 새 토큰으로 딱 한 번만 다시 보낸다. 예전엔 재발급만 하고
      // 원 요청은 그대로 실패시켜서, 호출부(09:00 openTodaySession 등)가 재시도 없이 죽었다.
      if (error?.response && REFRESH_ERROR_CODES.includes(errCd)) {
        const config = error.config as (InternalAxiosRequestConfig & { _kisTokenRetried?: boolean; }) | undefined;
        const newToken = await refreshKisToken(envOverride);
        if (config && !config._kisTokenRetried) {
          console.warn(`[kis:${env}] token rejected (${errCd}), retrying once with new token`);
          config._kisTokenRetried = true;
          config.headers = AxiosHeaders.from(config.headers).set('Authorization', `Bearer ${newToken}`);
          return instance.request(config);
        }
        error.response.data = { rt_cd: 'nosession' };
        return Promise.reject(error);
      }

      // 드물게 레이트리밋이 진짜 HTTP 레벨 에러(429 등)로 오는 경우에 대한 방어선.
      const retried = error?.response && await retryIfRateLimited(errCd, error.config);
      if (retried) {
        return retried;
      }

      // HTTP 응답 자체를 못 받은 경우(소켓 리셋 등, error.response가 없음) - 위 두 분기 다
      // error.response를 전제로 하기 때문에 이전엔 여기서 재시도 없이 바로 실패 처리됐다.
      if (!error?.response && NETWORK_RETRY_CODES.includes(error?.code)) {
        const networkRetried = await retryRequest(error.config, `network error (${error.code})`);
        if (networkRetried) {
          return networkRetried;
        }
      }

      return Promise.reject(error);
    },
  );

  cachedClients.set(env, { instance, expiresAt });
  return instance;
}