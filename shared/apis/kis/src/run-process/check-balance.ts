import { InquireBalance, ResponseInquireBalance, ResponseInquireBalanceSummary } from '../trading';

export type CheckBalanceListener = (data: ResponseInquireBalance[], summary: ResponseInquireBalanceSummary) => void;

class ProcessCheckBalance {

  listeners: Set<CheckBalanceListener> = new Set();
  
  processing:boolean = false;

  async mainProcess() {
    try {
      const data = await InquireBalance();
      this.listeners.forEach((func) => {
        try {
          func(data.output1 || [], data.output2[0] || {});
        } catch (e) {
          console.log(e);    
        }
      });
    } catch (e) {
      console.log(e);
    }
  }

  run() {
    this.processing = true;
    setTimeout(async () => {
      if (this.listeners.size > 0) {
        await this.mainProcess();
      }
      this.processing && this.run();
    }, 1000);
  }

  destroy() {
    this.listeners.clear();
    this.processing = false;
  }

  addListener(func: CheckBalanceListener) {
    !this.listeners.has(func) && this.listeners.add(func);
  }

  removeListener(func: CheckBalanceListener) {
    this.listeners.delete(func);
  }

}

export const CheckBalance = new ProcessCheckBalance();