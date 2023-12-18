jest.mock('./src/env-constants', async () => ({
  VITE_KIS_HOST: process.env.VITE_KIS_HOST,
  VITE_KIS_APP_KEY: process.env.VITE_KIS_APP_KEY,
  VITE_KIS_APP_SECRET: process.env.VITE_KIS_APP_SECRET,
  VITE_KIS_CANO: process.env.VITE_KIS_CANO,
}));