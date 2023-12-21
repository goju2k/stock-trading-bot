import { InquireBalance, OrderCache, ResponseInquireBalance } from '@shared/apis/kis';

import { TradingStrategy } from './abstract/trading-strategy';

import { removeOrderToday } from '../utils/local-store';

export class SellByPercent extends TradingStrategy {
  
  highPercent!:number;

  lowPercent!:number;

  orderInfo?:ResponseInquireBalance;

  constructor(code:string, highPercent:number, lowPercent:number) {
    super(code);
    this.highPercent = highPercent;
    this.lowPercent = lowPercent;
    this.process();
  }

  checking(): void {
    setTimeout(async () => {
      const data = await InquireBalance();
      const [ filtered ] = data.output.filter((item) => item.pdno === this.code);
      if (filtered) {
        this.orderInfo = filtered;
        this.state = 'sell-order';
        this.sellOrder();
      } else {
        this.checking();
      }
    }, 1000);
  }

  sellOrder(): void {

    if (this.orderInfo) {

      // 기준금액
      const myAmt = Number(this.orderInfo.pchs_avg_pric); // 나의 보유 평균 가격
      const count = Number(this.orderInfo.hldg_qty); // 보유 수량

      // 상위
      const highAmt = (myAmt + ((myAmt * this.highPercent) / 100)).toFixed(0);
      OrderCache({
        body: {
          BUY: false, 
          PDNO: this.orderInfo.pdno,
          ORD_QTY: String(count),
          ORD_DVSN: '00', // 00: 지정가
          ORD_UNPR: highAmt, 
        },
      }).then((res) => {
        if (res.rt_cd !== '0') {
          this.processError(`상위 매도주문 (${this.highPercent}%) 실패`);
        }
      });

      // 하위
      const lowAmt = (myAmt - ((myAmt * this.lowPercent) / 100)).toFixed(0);
      OrderCache({
        body: {
          BUY: false, 
          PDNO: this.orderInfo.pdno,
          ORD_QTY: String(count),
          ORD_DVSN: '00', // 00: 지정가
          ORD_UNPR: lowAmt, 
        },
      }).then((res) => {
        if (res.rt_cd !== '0') {
          this.processError(`하위 매도주문 (${this.lowPercent}%) 실패`);
        }
      });

      // sell wait 으로..
      this.state = 'sell-waiting';
      this.sellWaiting();

    } else {
      this.processError('주문정보 조회 실패');
    }

  }

  sellWaiting(): void {
    setTimeout(async () => {
      const data = await InquireBalance();
      const [ filtered ] = data.output.filter((item) => item.pdno === this.code);
      if (filtered) {
        this.sellWaiting();
      } else {
        this.state = 'done';
        this.done();
      }
    }, 1000);
  }

  done(): void {
    this.stateMessage = '(종료) 판매완료';
    removeOrderToday(); // 오늘 주문내역을 초기화 해서 다음 주문으로 이어지도록 처리
  }

}