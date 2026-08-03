import { TradingConfig } from '@prisma/client';

import { logTradeEvent } from './log-trade-event';
import { PositionWatcher } from './position-watcher';
import { TradingRuntime } from './runtime';

import { inquireBalance, placeMarketOrder } from '../kis';
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

  // 1건당 매수금액 = 가용현금(prvs_rcdl_excc_amt) * orderAmtPercent, maxOrderAmt는 절대 상한선으로만
  // 작동 - 계좌 자본금이 얼마든(모의/실전) 같은 %로 대응되고, 수익이 나서 가용현금이 늘면 다음
  // 매수 사이즈도 같이 커진다(2026-08-04, 정적 30,000원 고정값에서 전환).
  const { summary } = await inquireBalance();
  const availableCash = Number(summary?.prvs_rcdl_excc_amt);
  if (!Number.isFinite(availableCash) || availableCash <= 0) {
    console.error(`[execute-buy] invalid/missing available cash from balance summary - skip buy for ${code}`, summary);
    return;
  }

  const orderAmt = Math.min(Math.floor(availableCash * (config.orderAmtPercent / 100)), config.maxOrderAmt);
  const qty = Math.floor(orderAmt / price);

  if (qty <= 0) {
    return;
  }

  let res;
  try {
    res = await placeMarketOrder({ buy: true, code, qty: String(qty) });
  } catch (error) {
    await logTradeEvent({ sessionId, type: 'buy_failed', code, name, message: `매수 실패(${sourceStrategy})\n${(error as Error).message}` });
    return;
  }

  if (res.rt_cd !== '0') {
    await logTradeEvent({ sessionId, type: 'buy_failed', code, name, message: `매수 실패(${sourceStrategy}) ${res.msg1}` });
    return;
  }

  const order = await prisma.order.create({ data: { sessionId, code, name, buyPrice: price, qty, kisOrderNo: res.output.ODNO, sourceStrategy } });

  await logTradeEvent({
    sessionId,
    type: 'buy_executed',
    code,
    name,
    message: `매수 체결(${sourceStrategy}) ${qty}주 @ ${price}원`,
    payload: { qty, price, sourceStrategy },
  });

  const watcher = await PositionWatcher.start(sessionId, order.id, code, name, config.highPercentage, config.lowPercentage, (w) => TradingRuntime.remove(w.code));
  TradingRuntime.add(watcher);
}