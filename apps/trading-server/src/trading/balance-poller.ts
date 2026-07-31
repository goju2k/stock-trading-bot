import { inquireBalance } from '../kis';
import { InquireBalanceItem, InquireBalanceSummary } from '../kis/types';

export type BalanceListener = (holdings: InquireBalanceItem[], summary?: InquireBalanceSummary) => void;

// 기존 shared/apis/kis/src/run-process/check-balance.ts (CheckBalance) 포팅.
// 리스너가 1개 이상 있는 동안 1초 간격으로 잔고를 조회해서 모든 리스너에 브로드캐스트한다.
class BalancePollerImpl {

  private listeners = new Set<BalanceListener>();

  private processing = false;

  private async tick() {
    try {
      const { holdings, summary } = await inquireBalance();
      this.listeners.forEach((listener) => {
        try {
          listener(holdings, summary);
        } catch (error) {
          console.error('[balance-poller] listener error', error);
        }
      });
    } catch (error) {
      console.error('[balance-poller] inquireBalance failed', error);
    }
  }

  run() {
    if (this.processing) return;
    this.processing = true;
    const loop = async () => {
      if (this.listeners.size > 0) {
        await this.tick();
      }
      if (this.processing) {
        setTimeout(loop, 1000);
      }
    };
    setTimeout(loop, 1000);
  }

  destroy() {
    this.listeners.clear();
    this.processing = false;
  }

  addListener(listener: BalanceListener) {
    this.listeners.add(listener);
  }

  removeListener(listener: BalanceListener) {
    this.listeners.delete(listener);
  }

}

export const BalancePoller = new BalancePollerImpl();