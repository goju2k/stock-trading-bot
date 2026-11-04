// ETN 종목코드는 순위/시세 응답과 주문(PDNO)에선 'Q520095'처럼 Q가 붙어서 오가는데,
// inquire-balance 잔고의 pdno에는 Q가 빠진 '520095'로 온다(2026-10-14~10-30 Q코드 ETN 7건이
// 전부 잔고 매칭에 실패 - 장중 손절/익절이 한 번도 안 걸렸고, 15:15 강제청산은 "보유수량 없음"으로
// 스킵됐다가 다음 날 09:00 liquidateStalePositions()에서야 팔렸으며 그 손익도 원래 Order에 안
// 붙었다). 잔고 pdno와 비교할 땐 반드시 isSameStockCode()를 쓸 것.
const ETN_CODE_PATTERN = /^Q(\d{6})$/;

export function isEtnCode(code: string) {
  return ETN_CODE_PATTERN.test(code);
}

// 'Q520095' -> '520095', 그 외 코드는 그대로.
export function toBalanceCode(code: string) {
  return code.replace(ETN_CODE_PATTERN, '$1');
}

export function isSameStockCode(a: string, b: string) {
  return toBalanceCode(a) === toBalanceCode(b);
}

// 잔고 pdno 하나에 대응할 수 있는 DB 쪽 코드 후보(숫자 6자리면 ETN 형식도 같이).
export function codeCandidatesForBalanceCode(pdno: string) {
  return /^\d{6}$/.test(pdno) ? [ pdno, `Q${pdno}` ] : [ pdno ];
}