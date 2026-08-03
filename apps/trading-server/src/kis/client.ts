import axios, { AxiosInstance } from 'axios';

import { KisEnvName, getKisEnvConfig } from './env';
import { scheduleKisRequest } from './request-queue';
import { getStoredToken, saveToken } from './token-store';

// 유효하지 않은/기간만료 token 응답 코드 (browser-side axios-instance.ts와 동일)
const REFRESH_ERROR_CODES = [ 'EGW00121', 'EGW00123' ];

// 초당 거래건수 초과 (KIS 공식 에러코드) - request-queue.ts로 페이싱을 해도 계정 공유/순간
// 버스트 등으로 여전히 뚫릴 수 있어서 마지막 방어선으로 재시도 처리한다.
const RATE_LIMIT_ERROR_CODE = 'EGW00201';
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_RETRY_DELAY_MS = 500;

// env별로 따로 캐싱한다 (real 전용 호출이 있어서 - 개장일 조회는 항상 real로 나가지만
// 거래 모드는 paper일 수 있음. 한 프로세스 안에서 두 env 클라이언트가 동시에 존재할 수 있다).
const cachedInstances = new Map<KisEnvName, AxiosInstance>();
const cachedAccessTokens = new Map<KisEnvName, string>();

async function issueToken(envOverride?: KisEnvName): Promise<string> {
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
  return data.access_token as string;
}

async function resolveAccessToken(envOverride?: KisEnvName): Promise<string> {
  const { env } = getKisEnvConfig(envOverride);
  const stored = await getStoredToken(env);
  if (stored && stored.expiresAt.getTime() > Date.now()) {
    return stored.accessToken;
  }
  return issueToken(envOverride);
}

// 강제 재발급 (401/session 만료 감지시 axios interceptor에서 호출)
export async function refreshKisToken(envOverride?: KisEnvName): Promise<string> {
  const { env } = getKisEnvConfig(envOverride);
  const token = await issueToken(envOverride);
  cachedAccessTokens.set(env, token);
  cachedInstances.delete(env);
  return token;
}

// envOverride 없으면 현재 거래 모드(KIS_ENV)를 쓴다. 개장일 조회처럼 거래 모드와 무관하게
// 항상 특정 env로 호출해야 하는 곳(quotations.ts의 fetchBusinessDay)만 명시적으로 넘긴다.
export async function getKisClient(envOverride?: KisEnvName): Promise<AxiosInstance> {
  const { env, host, appKey, appSecret } = getKisEnvConfig(envOverride);

  const existing = cachedInstances.get(env);
  if (existing && cachedAccessTokens.has(env)) {
    return existing;
  }

  const accessToken = await resolveAccessToken(envOverride);

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

  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const errCd = error?.response?.data?.msg_cd;

      if (error?.response && REFRESH_ERROR_CODES.includes(errCd)) {
        await refreshKisToken(envOverride);
        error.response.data = { rt_cd: 'nosession' };
        return Promise.reject(error);
      }

      // request-queue로 페이싱해도 계정 공유/순간 버스트 등으로 여전히 초당 제한에 걸릴 수 있다 -
      // 마지막 방어선으로 짧게 대기 후 몇 번 재시도한다 (그래도 실패하면 호출부가 알 수 있게 던짐).
      if (error?.response && errCd === RATE_LIMIT_ERROR_CODE) {
        const retryCount = (error.config?._kisRateLimitRetryCount ?? 0) + 1;
        if (retryCount <= RATE_LIMIT_MAX_RETRIES) {
          console.warn(`[kis:${env}] rate limited (${RATE_LIMIT_ERROR_CODE}), retry ${retryCount}/${RATE_LIMIT_MAX_RETRIES}`);
          error.config._kisRateLimitRetryCount = retryCount;
          await new Promise((resolve) => { setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS * retryCount); });
          return instance.request(error.config);
        }
      }

      return Promise.reject(error);
    },
  );

  cachedAccessTokens.set(env, accessToken);
  cachedInstances.set(env, instance);
  return instance;
}