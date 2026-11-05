import { remainderToSell } from './position-watcher';

describe('remainderToSell (부분체결 잔량 매도)', () => {
  it('2026-11-05 227540: 50주 중 13주만 팔린 뒤 나머지 37주가 들어오면 37주를 판다', () => {
    expect(remainderToSell('37', 50, 13)).toBe(37);
  });

  it('주문가능수량이 늦게 줄어 매도 대기분까지 보여도 매수 수량 - 매도 주문 수량을 넘지 않는다', () => {
    // 50주 전량 체결 후 50주 매도 주문 - 잔고 반영이 늦어 주문가능수량이 아직 50으로 보이는 경우
    expect(remainderToSell('50', 50, 50)).toBe(0);
    // 13주 매도 주문 직후 주문가능수량이 아직 13(대기분)으로 보이는 경우 - 최대 37까지만
    expect(remainderToSell('13', 50, 13)).toBe(13);
    expect(remainderToSell('100', 50, 13)).toBe(37);
  });

  it('주문가능수량이 없거나 숫자가 아니면 아무것도 안 판다(예전 동작)', () => {
    expect(remainderToSell(undefined, 50, 13)).toBe(0);
    expect(remainderToSell('', 50, 13)).toBe(0);
    expect(remainderToSell('abc', 50, 13)).toBe(0);
  });

  it('매수 수량 정보가 없으면(0) 안 판다', () => {
    expect(remainderToSell('37', 0, 0)).toBe(0);
  });
});