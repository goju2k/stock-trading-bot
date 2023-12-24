jest.mock('./src/env-constants', () => ({
  VITE_KIS_HOST: process.env.VITE_KIS_HOST,
  VITE_KIS_APP_KEY: process.env.VITE_KIS_APP_KEY,
  VITE_KIS_APP_SECRET: process.env.VITE_KIS_APP_SECRET,
  VITE_KIS_CANO: process.env.VITE_KIS_CANO,
  VITE_KIS_TOKEN: process.env.VITE_KIS_TOKEN,
  VITE_JEST_FLAG: true,
}));