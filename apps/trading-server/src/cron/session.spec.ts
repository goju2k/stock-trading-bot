import { mergeStaleLiquidation } from './session';

describe('mergeStaleLiquidation (익일 잔여 정리 기록 합치기)', () => {
  it('2026-11-24 480310: 전날 58주 매도 기록 중 41주가 남아 있었다면 17주분 손익을 살려서 합친다', () => {
    // 전날 15:15: 58주 @16780, 손익 -2315로 기록 / 오늘 09:00: 41주 @16725, 손익 -3891
    const merged = mergeStaleLiquidation({ sellQty: 58, sellPrice: 16780, pnl: -2315 }, 41, 16725, -3891);
    expect(merged.sellQty).toBe(58);
    expect(merged.pnl).toBe(Math.round(-2315 * (17 / 58)) - 3891);
    expect(merged.sellPrice).toBe(Math.round((16780 * 17 + 16725 * 41) / 58));
  });

  it('전날 기록이 없거나 전부 남아 있으면 이번 정리 결과만 쓴다(예전 동작)', () => {
    expect(mergeStaleLiquidation({ sellQty: null, sellPrice: null, pnl: null }, 41, 16725, -3891)).toEqual({ sellQty: 41, sellPrice: 16725, pnl: -3891 });
    expect(mergeStaleLiquidation({ sellQty: 41, sellPrice: 16780, pnl: -2000 }, 41, 16725, -3891)).toEqual({ sellQty: 41, sellPrice: 16725, pnl: -3891 });
  });
});