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

// KIS_ENV 미설정시 실계좌 매매를 막기 위해 기본값은 'paper'. envOverride를 주면 현재
// 거래 모드와 무관하게 해당 env의 자격증명을 강제로 쓴다 (예: 개장일 조회처럼 모의투자
// TR이 아예 지원 안 되는 엔드포인트를 항상 real로 호출해야 하는 경우 - kis/quotations.ts 참고).
export function getKisEnvConfig(envOverride?: KisEnvName): KisEnvConfig {
  const env: KisEnvName = envOverride ?? (process.env.KIS_ENV === 'real' ? 'real' : 'paper');
  const prefix = env === 'real' ? 'KIS_REAL_' : 'KIS_PAPER_';
  return {
    env,
    host: required(`${prefix}HOST`),
    appKey: required(`${prefix}APP_KEY`),
    appSecret: required(`${prefix}APP_SECRET`),
    cano: required(`${prefix}CANO`),
  };
}