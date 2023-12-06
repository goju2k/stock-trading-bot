import axios from 'axios';

const headers = {
  'content-type': 'application/json; charset=utf-8',
  appkey: import.meta.env.VITE_KIS_APP_KEY,
  appsecret: import.meta.env.VITE_KIS_APP_SECRET,
  Authorization: `Bearer ${import.meta.env.VITE_KIS_AUTH_TOKEN}`,
  custtype: 'P',
};

console.log('headers', headers);

const kisAxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_KIS_HOST,
  headers,
});

export const KisApiInstance = kisAxiosInstance;