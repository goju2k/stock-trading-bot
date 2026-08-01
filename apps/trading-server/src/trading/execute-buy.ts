import { TradingConfig } from '@prisma/client';

import { logTradeEvent } from './log-trade-event';
import { PositionWatcher } from './position-watcher';
import { TradingRuntime } from './runtime';

import { placeMarketOrder } from '../kis';
import { getPrisma } from '../lib/prisma';

export interface ExecuteBuyInput {
  sessionId: number;
  config: TradingConfig;
  code: string;
  name?: string;
  price: number;
  // 어느 진입 전략이 이 매수를 트리거했는지 ('volume_rank' | 'vi_release' | ...).
  sourceStrategy: string;
}

// 매수 주문 실행 + Order/TradeEvent 기록 + PositionWatcher 기동. scanner.ts(거래대금순위)와
// vi-scanner.ts(VI 해제 모멘텀)가 공유하는 공통 매수 체결 경로 - 진입 신호만 다르고 이후
// 체결/청산 처리는 전략 무관하게 동일하다.
export async function executeBuy({ sessionId, config, code, name, price, sourceStrategy }: ExecuteBuyInput) {
  const prisma = getPrisma();
  const qty = Math.floor(config.maxOrderAmt / price);

  if (qty <= 0) {
    return;
  }

  const res = await placeMarketOrder({ buy: true, code, qty: String(qty) });

  if (res.rt_cd !== '0') {
    await logTradeEvent({ sessionId, type: 'buy_failed', code, message: `매수실패(${sourceStrategy}) ${res.msg1}` });
    return;
  }

  const order = await prisma.order.create({ data: { sessionId, code, name, buyPrice: price, qty, kisOrderNo: res.output.ODNO, sourceStrategy } });

  await logTradeEvent({
    sessionId,
    type: 'buy_executed',
    code,
    message: `매수완료(${sourceStrategy}) ${qty}주 @ ${price}원`,
    payload: { qty, price, sourceStrategy },
  });

  const watcher = await PositionWatcher.start(order.id, code, config.highPercentage, config.lowPercentage, (w) => TradingRuntime.remove(w.code));
  TradingRuntime.add(watcher);
}