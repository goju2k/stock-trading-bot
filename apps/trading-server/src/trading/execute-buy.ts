import { Prisma, TradingConfig } from '@prisma/client';

import { classifyHeadline } from './headline-keywords';
import { logTradeEvent } from './log-trade-event';
import { getMarketTickDelta } from './market-condition';
import { searchGoogleNews } from './news-search';
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
  // vi_release 소스일 때만 vi-scanner.ts가 채워서 넘김 - 회고용 스냅샷 (Order.viKindCode/viDprt/viReleaseHour).
  viKindCode?: string;
  viDprt?: string;
  viReleaseHour?: string;
  // 매수를 트리거한 스캐너 응답 스냅샷 - 회고용 (Order.scanSnapshot).
  scanSnapshot?: Prisma.InputJsonValue;
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

// getOrderedCodesToday()(Order 테이블 조회)만으로는 같은 틱에 서로 다른 전략이 동시에 같은
// 종목을 찾아내는 걸 못 막는다 - 두 스캐너 모두 아직 어느 쪽도 Order를 커밋하기 전에 조회하면
// 둘 다 "아직 안 샀음"으로 보고 동시에 매수를 시도한다(2026-08-10 실사고: 217590 티엠씨를
// volume_rank/vi_release가 0.9초 간격으로 동시 매수 - KIS 계좌엔 합쳐서 잡히고 한쪽 watcher는
// 매도주문 실패로 error 상태만 남았다). executeBuy()가 세 전략의 유일한 공유 진입점이므로,
// 여기 진입 시점(첫 await 이전, 완전히 동기적으로)에 즉시 in-memory Set으로 종목을 예약한다 -
// JS는 싱글스레드라 동기 코드 사이엔 다른 비동기 작업이 끼어들 수 없으므로 이 예약 자체는
// 원자적이다. 재시작하면 자연히 비워지는 순수 인메모리 락이라 DB 영속화는 필요 없다 -
// 매수 시도가 몇 초 안에 끝나는 동안만 막으면 되는 용도.
const buyLocks = new Set<string>();

function reserveBuyLock(code: string): boolean {
  if (buyLocks.has(code)) return false;
  buyLocks.add(code);
  return true;
}

// 매수 자체를 막지 않기 위해 executeBuy()에서 await 없이(fire-and-forget) 호출한다 - 뉴스
// 조회가 늦거나 실패해도 매수/매도 흐름에는 전혀 영향이 없다(2026-08-14, 회고용 데이터).
// KIS news-title 대신 구글 뉴스 RSS(news-search.ts)를 종목명으로 검색 - KIS 쪽은 실제
// 언론기사보다 KIS 자체생성 시황요약이 대부분이라 신호가 약했다(같은 날 23건 백필 테스트에서
// 22건이 neutral로 나옴). 종목명 검색 결과 중 가장 최근 항목 하나를 키워드 매칭해서 저장 -
// 검색 결과가 없거나 조회 실패시 조용히 아무것도 안 남긴다(이미 null인 컬럼 그대로 둠).
async function attachHeadline(orderId: number, code: string, name?: string) {
  try {
    const items = await searchGoogleNews(name || code);
    const [ latest ] = items;
    if (!latest) return;

    const { sentiment, keyword } = classifyHeadline(latest.title);
    await getPrisma().order.update({
      where: { id: orderId },
      data: { headline: latest.title, headlineSentiment: sentiment, headlineKeyword: keyword },
    });
  } catch (error) {
    console.error(`[execute-buy] headline fetch failed for ${code}`, error);
  }
}

// 매수 주문 실행 + Order/TradeEvent 기록 + PositionWatcher 기동. scanner.ts(거래대금순위)와
// vi-scanner.ts(VI 해제 모멘텀)가 공유하는 공통 매수 체결 경로 - 진입 신호만 다르고 이후
// 체결/청산 처리는 전략 무관하게 동일하다.
export async function executeBuy({ sessionId, config, code, name, price, sourceStrategy, viKindCode, viDprt, viReleaseHour, scanSnapshot }: ExecuteBuyInput) {
  if (!reserveBuyLock(code)) {
    console.log(`[execute-buy] ${code} 다른 전략이 이미 매수 시도 중이라 스킵 (${sourceStrategy})`);
    return;
  }

  try {
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

    const order = await prisma.order.create({ data: { sessionId, code, name, buyPrice: price, qty, kisOrderNo: res.output.ODNO, sourceStrategy, viKindCode, viDprt, viReleaseHour, kospiDeltaAtBuy: getMarketTickDelta(), scanSnapshot } });

    await logTradeEvent({
      sessionId,
      type: 'buy_executed',
      code,
      name,
      message: `매수 체결(${sourceStrategy}) ${qty}주 @ ${price}원`,
      payload: { qty, price, sourceStrategy },
    });

    const settings = {
      highPercentage: config.highPercentage,
      lowPercentage: config.lowPercentage,
      sellStrategy: config.sellStrategy,
      quickStopEnabled: config.quickStopEnabled,
      cut60sEnabled: config.cut60sEnabled,
    };
    const watcher = await PositionWatcher.start(sessionId, order.id, code, name, sourceStrategy, settings, order.orderedAt, (w) => TradingRuntime.remove(w.code));
    TradingRuntime.add(watcher);

    attachHeadline(order.id, code, name);
  } finally {
    // 성공/스킵/실패 무관하게 항상 해제 - 스킵된 경우 다른 전략이 나중에 다시 시도할 수 있는
    // 기존 동작(각 스캐너 자신의 passedCodes/viActedCodes 풀만 스킵을 기억)은 그대로 둔다.
    buyLocks.delete(code);
  }
}