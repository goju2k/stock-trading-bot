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

// 1건당 매수금액의 최대/최소 기준액. 장 시작 시점 가용현금(TradingSession.startingCash) 스냅샷에
// 고정 %를 곱해서 계산하고 장중엔 다시 계산하지 않는다 - "현재" 가용현금 기준으로 매번 계산하면
// 포지션이 쌓일수록 가용현금이 줄어서 주문금액도 같이 쪼그라들다가 아주 작은 단위로 계속 사들이며
// 보유 포지션 수만 과도하게 늘어나는 문제가 있었다(2026-08-04). startingCash 스냅샷이 없는
// 날(장 시작 시점 KIS 조회 실패 등)은 예전처럼 "현재" 가용현금을 기준으로 대신 쓴다.
async function resolveOrderAmtRange(sessionId: number, config: TradingConfig, fallbackBasis: number) {
  const session = await getPrisma().tradingSession.findUnique({ where: { id: sessionId }, select: { startingCash: true } });
  const basis = session?.startingCash ?? fallbackBasis;

  return {
    maxOrderAmt: Math.min(Math.floor(basis * (config.orderAmtPercent / 100)), config.maxOrderAmt),
    minOrderAmt: Math.floor(basis * (config.minOrderAmtPercent / 100)),
  };
}

// 매수 주문 실행 + Order/TradeEvent 기록 + PositionWatcher 기동. scanner.ts(거래대금순위)와
// vi-scanner.ts(VI 해제 모멘텀)가 공유하는 공통 매수 체결 경로 - 진입 신호만 다르고 이후
// 체결/청산 처리는 전략 무관하게 동일하다.
export async function executeBuy({ sessionId, config, code, name, price, sourceStrategy }: ExecuteBuyInput) {
  const prisma = getPrisma();

  const { summary } = await inquireBalance();
  const availableCash = Number(summary?.prvs_rcdl_excc_amt);
  if (!Number.isFinite(availableCash) || availableCash <= 0) {
    console.error(`[execute-buy] invalid/missing available cash from balance summary - skip buy for ${code}`, summary);
    return;
  }

  const { maxOrderAmt, minOrderAmt } = await resolveOrderAmtRange(sessionId, config, availableCash);

  // 가용현금이 최소 주문금액 밑으로 내려가면 매수 후보가 있어도 더 이상 신규 매수를 하지 않는다 -
  // 별도의 "최대 보유 포지션 수" 설정 없이 이 조건 하나로 신규 진입을 자연스럽게 막는다.
  if (availableCash < minOrderAmt) {
    return;
  }

  const orderAmt = Math.min(availableCash, maxOrderAmt);
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