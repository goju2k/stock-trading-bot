import { InquireBalance, OrderCache, ResponseInquireBalance } from '@shared/apis/kis';
import { TradingStrategy, removeOrderToday } from '@shared/states/global';

export class SellByPercent extends TradingStrategy {
  
  highPercent!:number;

  lowPercent!:number;

  sellAmt:number = 0;

  orderInfo?:ResponseInquireBalance;

  constructor(code:string, highPercent:number, lowPercent:number) {
    super(code);
    this.highPercent = highPercent;
    this.lowPercent = lowPercent;
    this.process();
  }

  checking(): void {

    this.state = 'checking';

    setTimeout(async () => {
      const filtered = await getBalance(this.code);
      if (filtered) {
        this.orderInfo = filtered;
        this.sellOrder();
      } else {
        this.checking();
      }
    }, 1000);
  }

  async sellOrder() {

    this.state = 'sell-order';

    if (this.orderInfo) {

      // 기준금액
      const myAmt = Number(this.orderInfo.pchs_avg_pric); // 나의 보유 평균 가격
      const count = Number(this.orderInfo.hldg_qty); // 보유 수량

      // 상위
      const highAmt = (myAmt + ((myAmt * this.highPercent) / 100)).toFixed(0);
      const resHigh = await OrderCache({
        body: {
          BUY: false, 
          PDNO: this.orderInfo.pdno,
          ORD_QTY: String(count),
          ORD_DVSN: '00', // 00: 지정가
          ORD_UNPR: highAmt, 
        },
      });

      if (resHigh.rt_cd !== '0') {
        this.processError(`상위 매도주문 (${this.highPercent}%) 실패`);
        return;
      }

      this.sellAmt = Number(highAmt);
      
      // 하위 => 정정 로직으로 변경해야함. 그때까지 주석처리
      // const lowAmt = (myAmt - ((myAmt * this.lowPercent) / 100)).toFixed(0);
      // const resLow = await OrderCache({
      //   body: {
      //     BUY: false, 
      //     PDNO: this.orderInfo.pdno,
      //     ORD_QTY: String(count),
      //     ORD_DVSN: '00', // 00: 지정가
      //     ORD_UNPR: lowAmt, 
      //   },
      // });
      
      // if (resLow.rt_cd !== '0') {
      //   this.processError(`하위 매도주문 (${this.lowPercent}%) 실패`);
      //   return;
      // }
      
      // sell wait 으로..
      this.sellWaiting();

    } else {
      this.processError('주문정보 조회 실패');
    }

  }

  sellWaiting(): void {
    
    this.state = 'sell-waiting';

    setTimeout(async () => {
      if (await hasBalance(this.code)) { // 잔고가 0 이상인것만...
        this.sellWaiting();
      } else {
        this.done();
      }
    }, 1000);
  }

  done(): void {
    this.state = 'done';
    this.stateMessage = '(종료) 판매완료';
    removeOrderToday(); // 오늘 주문내역을 초기화 해서 다음 주문으로 이어지도록 처리
  }

  toString() {
    return `${super.toString()} ${this.sellAmt > 0 ? `매도 ${this.sellAmt}원` : ''}`;
  }

}

// 주식 잔고 조회
const getBalance = async (code:string) => {
  const data = await InquireBalance();
  const [ filtered ] = data.output1.filter((item) => item.pdno === code);

  // 잔고가 0 이상인지 체크
  return filtered && Number(filtered.hldg_qty) > 0 ? filtered : undefined;
};

// 주식 잔고 존재 체크
const hasBalance = async (code:string) => (!!await getBalance(code));