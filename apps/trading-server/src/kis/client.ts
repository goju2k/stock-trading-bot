import axios, { AxiosInstance } from 'axios';

import { getKisEnvConfig } from './env';
import { getStoredToken, saveToken } from './token-store';

// 유효하지 않은/기간만료 token 응답 코드 (browser-side axios-instance.ts와 동일)
const REFRESH_ERROR_CODES = [ 'EGW00121', 'EGW00123' ];

let cachedInstance: AxiosInstance | undefined;
let cachedAccessToken: string | undefined;

async function issueToken(): Promise<string> {
  const { env, host, appKey, appSecret } = getKisEnvConfig();
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

async function resolveAccessToken(): Promise<string> {
  const { env } = getKisEnvConfig();
  const stored = await getStoredToken(env);
  if (stored && stored.expiresAt.getTime() > Date.now()) {
    return stored.accessToken;
  }
  return issueToken();
}

// 강제 재발급 (401/session 만료 감지시 axios interceptor에서 호출)
export async function refreshKisToken(): Promise<string> {
  const token = await issueToken();
  cachedAccessToken = token;
  cachedInstance = undefined;
  return token;
}

export async function getKisClient(): Promise<AxiosInstance> {
  if (cachedInstance && cachedAccessToken) {
    return cachedInstance;
  }

  const { host, appKey, appSecret } = getKisEnvConfig();
  const accessToken = await resolveAccessToken();

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

  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const errCd = error?.response?.data?.msg_cd;
      if (error?.response && REFRESH_ERROR_CODES.includes(errCd)) {
        await refreshKisToken();
        error.response.data = { rt_cd: 'nosession' };
      }
      return Promise.reject(error);
    },
  );

  cachedAccessToken = accessToken;
  cachedInstance = instance;
  return instance;
}