import { PositionState } from '@prisma/client';

import { BalanceListener, BalancePoller } from './balance-poller';
import { logTradeEvent } from './log-trade-event';
import { getMarketTickDelta } from './market-condition';

import { inquireBalance, placeMarketOrder } from '../kis';
import { InquireBalanceItem } from '../kis/types';
import { getPrisma } from '../lib/prisma';

export type OnDone = (watcher: PositionWatcher) => void;

export interface ResumeRow {
  id: number;
  orderId: number;
  code: string;
  state: PositionState;
  highPercentage: number;
  lowPercentage: number;
  sellAmtHigh: unknown;
  sellAmtLow: unknown;
  peakPrice: unknown;
  highOrLow: string | null;
}

// 기존 shared/states/global/.../trading-strategy.ts(TradingStrategy) +
// services/trading/src/trading-strategy/sell-by-percent.ts(SellByPercent) 포팅.
// 구현체가 하나뿐이라 별도 추상 베이스클래스로 안 나누고 하나로 합쳤다.
// checking(매수확인) -> watching_for_sell(목표가 대기) -> sell_waiting(매도체결 대기) -> done|error
export class PositionWatcher {

  readonly id: number;

  readonly sessionId: number;

  readonly orderId: number;

  readonly code: string;

  readonly name: string | null;

  readonly highPercentage: number;

  readonly lowPercentage: number;

  state: PositionState = 'checking';

  sellAmtHigh = 0;

  sellAmtLow = 0;

  // 트레일링 스탑 고점 (watching_for_sell 진입 이후 관측된 최고가)
  peakPrice = 0;

  highOrLow: 'high' | 'low' | '' = '';

  stateMessage = '';

  private onDone?: OnDone;

  private activeListener?: BalanceListener;

  private constructor(id: number, sessionId: number, orderId: number, code: string, name: string | null, highPercentage: number, lowPercentage: number, onDone?: OnDone) {
    this.id = id;
    this.sessionId = sessionId;
    this.orderId = orderId;
    this.code = code;
    this.name = name;
    this.highPercentage = highPercentage;
    this.lowPercentage = lowPercentage;
    this.onDone = onDone;
  }

  // 신규 매수 직후 호출 (scanner.ts). 매수 시점의 %를 스냅샷으로 저장해서 도중에
  // 설정이 바뀌거나 서버가 재시작돼도 이 포지션은 원래 기준 그대로 동작한다.
  static async start(sessionId: number, orderId: number, code: string, name: string | null | undefined, highPercentage: number, lowPercentage: number, onDone?: OnDone) {
    const row = await getPrisma().positionWatcher.create({ data: { orderId, code, highPercentage, lowPercentage, state: 'checking' } });
    const watcher = new PositionWatcher(row.id, sessionId, orderId, code, name ?? null, highPercentage, lowPercentage, onDone);
    watcher.checking();
    return watcher;
  }

  // 서버 재시작 후 미종료 watcher 복구 (runtime.ts)
  static resume(row: ResumeRow, sessionId: number, name: string | null, onDone?: OnDone) {
    const watcher = new PositionWatcher(row.id, sessionId, row.orderId, row.code, name, row.highPercentage, row.lowPercentage, onDone);
    watcher.sellAmtHigh = row.sellAmtHigh ? Number(row.sellAmtHigh) : 0;
    watcher.sellAmtLow = row.sellAmtLow ? Number(row.sellAmtLow) : 0;
    watcher.peakPrice = row.peakPrice ? Number(row.peakPrice) : 0;
    watcher.highOrLow = (row.highOrLow as 'high' | 'low' | '') || '';

    if (row.state === 'sell_waiting') {
      watcher.sellWaiting();
    } else if (row.state === 'watching_for_sell') {
      watcher.watchForSell();
    } else {
      watcher.checking();
    }

    console.log(`[position-watcher] resumed ${row.code} at state=${row.state}`);
    return watcher;
  }

  // 15:15 강제청산 트리거, 관리자 강제매도(API) 등 외부에서 호출. notify는 기본 true(개별
  // 알림) - 관리자가 종목 하나를 수동으로 누른 경우엔 그 결과가 바로 와야 하지만, 15:15
  // 일괄청산처럼 N건을 한 번에 처리할 땐 호출부에서 false로 넘기고 끝난 뒤 요약 메시지
  // 하나로 묶는다(2026-08-05: 이걸 안 해서 청산 대상 수만큼 개별 알림이 갔던 문제).
  async forceSell(reason: string, options?: { notify?: boolean; }) {
    if (this.activeListener) {
      BalancePoller.removeListener(this.activeListener);
    }

    const { holdings } = await inquireBalance();
    const current = getHolding(holdings, this.code);
    if (!current) {
      await this.done('보유수량 없음 (강제청산 스킵)');
      return;
    }

    let res;
    try {
      res = await placeMarketOrder({ buy: false, code: this.code, qty: current.hldg_qty });
    } catch (error) {
      await this.fail(`강제청산 매도 예외\n${(error as Error).message}`);
      return;
    }
    if (res.rt_cd !== '0') {
      await this.fail(`강제청산 매도 실패\n${res.msg1}`);
      return;
    }

    // watchForSell()의 정상 매도 경로와 동일하게 실제 매입평균가 기준으로 실현손익을 계산해서
    // 바로 영속화한다 - 예전엔 이걸 안 남겨서(qty만 기록) 강제청산 손익이 리포트에서 통째로
    // 빠지는 버그가 있었다(2026-08-05 발견).
    const price = Number(current.prpr);
    const sellQty = Number(current.hldg_qty);
    const pnl = Math.round((price - Number(current.pchs_avg_pric)) * sellQty);
    await this.persist({ sellPrice: price, sellQty, pnl, kospiDeltaAtSell: getMarketTickDelta() });

    await logTradeEvent({ sessionId: this.sessionId, type: 'forced_liquidation', code: this.code, name: this.name, message: reason, payload: { qty: sellQty, price, pnl }, notify: options?.notify ?? true });

    this.sellWaiting();
  }

  // 세션 마감(closeTodaySession) 시 외부에서 호출 - 그날 안에 못 끝난 포지션을 더 이상 지켜보지
  // 않는다. done()/fail()과 달리 state는 안 건드린다 - 왜 못 끝났는지가 그대로 남아있어야 다음날
  // 09:00 liquidateStalePositions()가 실제 잔고 기준으로 정리할 수 있다. BalancePoller 리스너만
  // 떼서, 장마감 이후에도 이 포지션 하나 때문에 BalancePoller가 계속 살아서 초당 1회씩 KIS를
  // 호출하는 걸 막는다(2026-08-05: sell_waiting에 갇힌 watcher 때문에 장마감 몇 시간 뒤까지도
  // 계속 폴링되다가 KIS 야간 점검 창구에 대고 실패 호출을 반복하던 문제).
  stopWatching(message: string) {
    if (this.activeListener) {
      BalancePoller.removeListener(this.activeListener);
      this.activeListener = undefined;
    }
    this.stateMessage = message;
    return this.persist({ stateMessage: message });
  }

  toString() {
    const target = this.sellAmtHigh > 0 ? `high:${this.sellAmtHigh} / low:${this.sellAmtLow}` : '';
    return `종목:[${this.code}] 처리상태:[${this.state}] ${this.stateMessage} ${target}`;
  }

  private persist(fields: Partial<{ state: PositionState; sellAmtHigh: number; sellAmtLow: number; peakPrice: number; highOrLow: string; stateMessage: string; sellPrice: number; sellQty: number; pnl: number; kospiDeltaAtSell: number; closedAt: Date; }>) {
    return getPrisma().positionWatcher.update({ where: { id: this.id }, data: fields }).catch((error) => {
      console.error(`[position-watcher:${this.code}] persist failed`, error);
    });
  }

  private checking() {
    this.state = 'checking';
    this.stateMessage = '매수 체크중';
    this.persist({ state: 'checking', stateMessage: this.stateMessage });

    const listener: BalanceListener = (holdings) => {
      const filtered = getHolding(holdings, this.code);
      if (filtered) {
        BalancePoller.removeListener(listener);
        this.watchForSell(filtered);
      }
    };
    this.activeListener = listener;
    BalancePoller.addListener(listener);
  }

  // 트레일링 스탑: high(익절)는 매수가 기준 고정, low(손절)는 진입 이후 관측된 고점(peakPrice)
  // 기준으로 매 틱마다 다시 계산해서 신고점을 찍을수록 손절선도 같이 끌어올린다(내려가지는 않음).
  private watchForSell(holding?: InquireBalanceItem) {
    this.state = 'watching_for_sell';
    this.stateMessage = '매도 체크중';
    this.persist({ state: 'watching_for_sell', stateMessage: this.stateMessage });

    const highAmt = holding ? Number((Number(holding.pchs_avg_pric) + (Number(holding.pchs_avg_pric) * this.highPercentage) / 100).toFixed(0)) : this.sellAmtHigh;

    if (holding) {
      const myAmt = Number(holding.pchs_avg_pric);
      this.sellAmtHigh = highAmt;
      this.peakPrice = Math.max(myAmt, Number(holding.prpr));
      this.sellAmtLow = Number((this.peakPrice - (this.peakPrice * this.lowPercentage) / 100).toFixed(0));
      this.stateMessage = `매도 타겟 : high:${highAmt} / low:${this.sellAmtLow} (trailing)`;
      this.persist({ sellAmtHigh: highAmt, sellAmtLow: this.sellAmtLow, peakPrice: this.peakPrice, stateMessage: this.stateMessage });
    }

    const listener: BalanceListener = async (holdings) => {
      if (!getHolding(holdings, this.code)) {
        BalancePoller.removeListener(listener);
        await this.done('(종료) 수동매도 감지');
        return;
      }

      const current = getHolding(holdings, this.code);
      if (!current || !highAmt || !this.sellAmtLow) return;

      const price = Number(current.prpr);

      if (price > this.peakPrice) {
        this.peakPrice = price;
        this.sellAmtLow = Number((this.peakPrice - (this.peakPrice * this.lowPercentage) / 100).toFixed(0));
        this.persist({ peakPrice: this.peakPrice, sellAmtLow: this.sellAmtLow });
      }

      const checkHigh = price >= highAmt;
      const checkLow = price <= this.sellAmtLow;
      if (!checkHigh && !checkLow) return;

      this.highOrLow = checkHigh ? 'high' : 'low';
      BalancePoller.removeListener(listener);
      await this.persist({ highOrLow: this.highOrLow });

      const { hldg_qty: qty } = current;

      // placeMarketOrder가 예외를 던지면(레이트리밋 등 HTTP 레벨 에러) 이 리스너는 이미
      // BalancePoller에서 제거된 뒤라 잡아주지 않으면 이 포지션은 영원히 방치된다 -
      // 반드시 fail()로 상태를 남기고 (error 이벤트로) 알림까지 나가게 한다.
      let res;
      try {
        res = await placeMarketOrder({ buy: false, code: this.code, qty });
      } catch (error) {
        await this.fail(`매도주문 예외\n${(error as Error).message}`);
        return;
      }

      if (res.rt_cd !== '0') {
        await this.fail(`매도주문 실패\n${res.msg1}`);
        return;
      }

      // 실현손익 = (매도가 - 실제 매입평균가) * 수량. Order.buyPrice(매수 시점 참고가/VI발동가)가
      // 아니라 KIS 잔고의 실시간 매입평균가(pchs_avg_pric)로 계산해야 정확하다 - 변동성 장에서는
      // 시장가 체결가가 참고가와 다를 수 있다(watchForSell 상단 comment 참고).
      const pnl = Math.round((price - Number(current.pchs_avg_pric)) * Number(qty));
      await this.persist({ sellPrice: price, sellQty: Number(qty), pnl, kospiDeltaAtSell: getMarketTickDelta() });

      await logTradeEvent({ sessionId: this.sessionId, type: 'sell_executed', code: this.code, name: this.name, message: `매도 체결 (${this.highOrLow}) ${qty}주 @ ${price}원 (손익 ${pnl}원)`, payload: { qty, price, pnl } });

      this.sellWaiting();
    };
    this.activeListener = listener;
    BalancePoller.addListener(listener);
  }

  private sellWaiting() {
    this.state = 'sell_waiting';
    this.stateMessage = '시장가 매도중';
    this.persist({ state: 'sell_waiting', stateMessage: this.stateMessage });

    const listener: BalanceListener = async (holdings) => {
      if (!getHolding(holdings, this.code)) {
        BalancePoller.removeListener(listener);
        await this.done('(종료) 판매완료');
      }
    };
    this.activeListener = listener;
    BalancePoller.addListener(listener);
  }

  private async done(message: string) {
    this.state = 'done';
    this.stateMessage = message;
    await this.persist({ state: 'done', stateMessage: message, closedAt: new Date() });
    this.onDone?.(this);
  }

  private async fail(message: string) {
    this.state = 'error';
    this.stateMessage = message;
    await this.persist({ state: 'error', stateMessage: message, closedAt: new Date() });
    await logTradeEvent({ sessionId: this.sessionId, type: 'error', code: this.code, name: this.name, message });
    this.onDone?.(this);
  }

}

function getHolding(holdings: InquireBalanceItem[], code: string) {
  const [ filtered ] = holdings.filter((item) => item.pdno === code && Number(item.hldg_qty) > 0);
  return filtered;
}