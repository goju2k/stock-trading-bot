import { PositionState } from '@prisma/client';

import { BalanceListener, BalancePoller } from './balance-poller';

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
  highOrLow: string | null;
}

// 기존 shared/states/global/.../trading-strategy.ts(TradingStrategy) +
// services/trading/src/trading-strategy/sell-by-percent.ts(SellByPercent) 포팅.
// 구현체가 하나뿐이라 별도 추상 베이스클래스로 안 나누고 하나로 합쳤다.
// checking(매수확인) -> watching_for_sell(목표가 대기) -> sell_waiting(매도체결 대기) -> done|error
export class PositionWatcher {

  readonly id: number;

  readonly orderId: number;

  readonly code: string;

  readonly highPercentage: number;

  readonly lowPercentage: number;

  state: PositionState = 'checking';

  sellAmtHigh = 0;

  sellAmtLow = 0;

  highOrLow: 'high' | 'low' | '' = '';

  stateMessage = '';

  private onDone?: OnDone;

  private activeListener?: BalanceListener;

  private constructor(id: number, orderId: number, code: string, highPercentage: number, lowPercentage: number, onDone?: OnDone) {
    this.id = id;
    this.orderId = orderId;
    this.code = code;
    this.highPercentage = highPercentage;
    this.lowPercentage = lowPercentage;
    this.onDone = onDone;
  }

  // 신규 매수 직후 호출 (scanner.ts). 매수 시점의 %를 스냅샷으로 저장해서 도중에
  // 설정이 바뀌거나 서버가 재시작돼도 이 포지션은 원래 기준 그대로 동작한다.
  static async start(orderId: number, code: string, highPercentage: number, lowPercentage: number, onDone?: OnDone) {
    const row = await getPrisma().positionWatcher.create({ data: { orderId, code, highPercentage, lowPercentage, state: 'checking' } });
    const watcher = new PositionWatcher(row.id, orderId, code, highPercentage, lowPercentage, onDone);
    watcher.checking();
    return watcher;
  }

  // 서버 재시작 후 미종료 watcher 복구 (runtime.ts)
  static resume(row: ResumeRow, onDone?: OnDone) {
    const watcher = new PositionWatcher(row.id, row.orderId, row.code, row.highPercentage, row.lowPercentage, onDone);
    watcher.sellAmtHigh = row.sellAmtHigh ? Number(row.sellAmtHigh) : 0;
    watcher.sellAmtLow = row.sellAmtLow ? Number(row.sellAmtLow) : 0;
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

  // 15:25 강제청산 트리거 등 외부에서 호출
  async forceSell(reason: string) {
    if (this.activeListener) {
      BalancePoller.removeListener(this.activeListener);
    }

    const { holdings } = await inquireBalance();
    const current = getHolding(holdings, this.code);
    if (!current) {
      await this.done('보유수량 없음 (강제청산 스킵)');
      return;
    }

    const res = await placeMarketOrder({ buy: false, code: this.code, qty: current.hldg_qty });
    if (res.rt_cd !== '0') {
      await this.fail(`강제청산 매도 실패\n${res.msg1}`);
      return;
    }

    await getPrisma().tradeEvent.create({ data: { type: 'forced_liquidation', code: this.code, message: `[${this.code}] ${reason}`, payload: { qty: current.hldg_qty } } });

    this.sellWaiting();
  }

  toString() {
    const target = this.sellAmtHigh > 0 ? `high:${this.sellAmtHigh} / low:${this.sellAmtLow}` : '';
    return `종목:[${this.code}] 처리상태:[${this.state}] ${this.stateMessage} ${target}`;
  }

  private persist(fields: Partial<{ state: PositionState; sellAmtHigh: number; sellAmtLow: number; highOrLow: string; stateMessage: string; }>) {
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

  private watchForSell(holding?: InquireBalanceItem) {
    this.state = 'watching_for_sell';
    this.stateMessage = '매도 체크중';
    this.persist({ state: 'watching_for_sell', stateMessage: this.stateMessage });

    let { sellAmtHigh: highAmt, sellAmtLow: lowAmt } = this;

    if (holding) {
      const myAmt = Number(holding.pchs_avg_pric);
      highAmt = Number((myAmt + (myAmt * this.highPercentage) / 100).toFixed(0));
      lowAmt = Number((myAmt - (myAmt * this.lowPercentage) / 100).toFixed(0));
      this.sellAmtHigh = highAmt;
      this.sellAmtLow = lowAmt;
      this.stateMessage = `매도 타겟 : high:${highAmt} / low:${lowAmt}`;
      this.persist({ sellAmtHigh: highAmt, sellAmtLow: lowAmt, stateMessage: this.stateMessage });
    }

    const listener: BalanceListener = async (holdings) => {
      if (!getHolding(holdings, this.code)) {
        BalancePoller.removeListener(listener);
        await this.done('(종료) 수동매도 감지');
        return;
      }

      const current = getHolding(holdings, this.code);
      if (!current || !highAmt || !lowAmt) return;

      const price = Number(current.prpr);
      const checkHigh = price >= highAmt;
      const checkLow = price <= lowAmt;
      if (!checkHigh && !checkLow) return;

      this.highOrLow = checkHigh ? 'high' : 'low';
      BalancePoller.removeListener(listener);
      await this.persist({ highOrLow: this.highOrLow });

      const { hldg_qty: qty } = current;
      const res = await placeMarketOrder({ buy: false, code: this.code, qty });

      if (res.rt_cd !== '0') {
        await this.fail(`매도주문 실패\n${res.msg1}`);
        return;
      }

      await getPrisma().tradeEvent.create({ data: { type: 'sell_executed', code: this.code, message: `[${this.code}] 매도주문 완료 (${this.highOrLow})`, payload: { qty, price } } });

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
    await this.persist({ state: 'done', stateMessage: message });
    this.onDone?.(this);
  }

  private async fail(message: string) {
    this.state = 'error';
    this.stateMessage = message;
    await this.persist({ state: 'error', stateMessage: message });
    await getPrisma().tradeEvent.create({ data: { type: 'error', code: this.code, message } });
    this.onDone?.(this);
  }

}

function getHolding(holdings: InquireBalanceItem[], code: string) {
  const [ filtered ] = holdings.filter((item) => item.pdno === code && Number(item.hldg_qty) > 0);
  return filtered;
}