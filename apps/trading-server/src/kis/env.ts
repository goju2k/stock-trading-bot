export type KisEnvName = 'paper' | 'real';

export interface KisEnvConfig {
  env: KisEnvName;
  host: string;
  appKey: string;
  appSecret: string;
  cano: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// KIS_ENV 미설정시 실계좌 매매를 막기 위해 기본값은 'paper'.
export function getKisEnvConfig(): KisEnvConfig {
  const env: KisEnvName = process.env.KIS_ENV === 'real' ? 'real' : 'paper';
  const prefix = env === 'real' ? 'KIS_REAL_' : 'KIS_PAPER_';
  return {
    env,
    host: required(`${prefix}HOST`),
    appKey: required(`${prefix}APP_KEY`),
    appSecret: required(`${prefix}APP_SECRET`),
    cano: required(`${prefix}CANO`),
  };
}