import { codeCandidatesForBalanceCode, isEtnCode, isSameStockCode, toBalanceCode } from './stock-code';

describe('stock-code', () => {
  it('Q로 시작하는 7자리만 ETN으로 본다', () => {
    expect(isEtnCode('Q520095')).toBe(true);
    expect(isEtnCode('520095')).toBe(false);
    expect(isEtnCode('0193T0')).toBe(false);
    expect(isEtnCode('Q52009')).toBe(false);
  });

  it('잔고 pdno(Q 없음)와 주문 코드(Q 있음)를 같은 종목으로 매칭한다', () => {
    expect(toBalanceCode('Q520095')).toBe('520095');
    expect(isSameStockCode('520095', 'Q520095')).toBe(true);
    expect(isSameStockCode('005930', '005930')).toBe(true);
    expect(isSameStockCode('0007C0', '0007C0')).toBe(true);
    expect(isSameStockCode('520095', 'Q520096')).toBe(false);
  });

  it('잔고 pdno에서 DB 코드 후보를 만든다', () => {
    expect(codeCandidatesForBalanceCode('520095')).toEqual([ '520095', 'Q520095' ]);
    expect(codeCandidatesForBalanceCode('0193T0')).toEqual([ '0193T0' ]);
  });
});