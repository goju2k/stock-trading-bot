import { KisEnvName } from './env';

// 시세/기준정보 조회는 실전·모의 공통 tr_id.
export const COMMON_TR_ID = {
  volumeRank: 'FHPST01710000',
  businessDay: 'CTCA0903R',
  viStatus: 'FHPST01390000', // 변동성완화장치(VI) 현황
  foreignInstitutionTotal: 'FHPTJ04400000', // 국내기관_외국인 매매종목가집계
  fluctuation: 'FHPST01700000', // 등락률 순위
};

// 계좌/주문 tr_id는 모의투자가 'V', 실전투자가 'T' 접두사를 쓴다.
export const TR_ID = {
  buy: (env: KisEnvName) => (env === 'real' ? 'TTTC0802U' : 'VTTC0802U'),
  sell: (env: KisEnvName) => (env === 'real' ? 'TTTC0801U' : 'VTTC0801U'),
  // NOTE: 실전은 실현손익 포함 잔고조회(inquire-balance-rlz-pl, tr_id TTTC8494R)를 쓰지만,
  // 모의투자 계좌는 이 엔드포인트를 지원하지 않는 것으로 알려져 있어 일반 잔고조회
  // (inquire-balance, tr_id VTTC8434R)로 대체한다. 실계좌 전환 전 KIS 공식 문서로 재검증할 것.
  balance: (env: KisEnvName) => (env === 'real' ? 'TTTC8494R' : 'VTTC8434R'),
};

export function balancePath(env: KisEnvName) {
  return env === 'real' ? 'trading/inquire-balance-rlz-pl' : 'trading/inquire-balance';
}