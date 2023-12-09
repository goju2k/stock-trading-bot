import axios from 'axios';

import EnvConstants from './env-constants';

const prevToken = window.localStorage.getItem('kis-token');

const headers = {
  'content-type': 'application/json; charset=utf-8',
  appkey: EnvConstants.VITE_KIS_APP_KEY,
  appsecret: EnvConstants.VITE_KIS_APP_SECRET,
  Authorization: `Bearer ${prevToken}`,
  custtype: 'P',
};

// console.log('headers', headers);

// refresh token
const refreshToken = async () => {
  const { data } = await instanceObject.instance.post(
    'oauth2/tokenP',
    {
      grant_type: 'client_credentials',
      appkey: headers.appkey,
      appsecret: headers.appsecret,
    },
  );
  headers.Authorization = `Bearer ${data.access_token}`;
  window.localStorage.setItem('kis-token', data.access_token);
  instanceObject.instance = createInstance();
  console.log('token refreshed => ', data.access_token);
};

// createInstance
const createInstance = () => {
  const kisAxiosInstance = axios.create({
    baseURL: EnvConstants.VITE_KIS_HOST,
    headers,
  });

  const refreshErrorCodes = [
    'EGW00121', // 유효하지 않은 token 입니다.
    'EGW00123', // 기간이 만료된 token 입니다.
  ];
  kisAxiosInstance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const errCd = error?.response?.data?.msg_cd;
      if (refreshErrorCodes.includes(errCd)) {
        refreshToken();
        return { rt_cd: 'nosession' };
      }
      return undefined;
    },
  );
  return kisAxiosInstance;
};

const instanceObject = { instance: createInstance() };

if (!prevToken) {
  refreshToken();
}

export const KisApi = instanceObject;