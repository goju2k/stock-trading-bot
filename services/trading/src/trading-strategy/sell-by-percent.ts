import { CheckBalance, CheckBalanceListener, OrderCache, ResponseInquireBalance } from '@shared/apis/kis';
import { TradingStrategy, removeOrderToday } from '@shared/states/global';

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

    this.state = 'checking';
    this.stateMessage = '매수 체크중';
    const check:CheckBalanceListener = async (data) => {
      const filtered = getBalance(data, this.code);
      if (filtered) {
        this.orderInfo = filtered;
        this.sellOrder();
        CheckBalance.removeListener(check);
      }
    };
    CheckBalance.addListener(check);

  }

  async sellOrder() {

    this.state = 'watching-for-sell';
    this.stateMessage = '매도 체크중';

    if (this.orderInfo) {

      // 기준금액
      const myAmt = Number(this.orderInfo.pchs_avg_pric); // 나의 보유 평균 가격
      const count = Number(this.orderInfo.hldg_qty); // 보유 수량

      // 상위 / 하위 매도 타겟 금액
      const highAmt = Number((myAmt + ((myAmt * this.highPercent) / 100)).toFixed(0));
      const lowAmt = Number((myAmt - ((myAmt * this.lowPercent) / 100)).toFixed(0));
      
      // 타겟 가격 체크
      const check:CheckBalanceListener = async (data) => {

        // 대상금액 매칭된 경우 (high & low) 시장가 매도 주문
        if (this.orderInfo 
        && (
          checkTargetBalance(data, this.code, highAmt, true) // high target
        || checkTargetBalance(data, this.code, lowAmt, false) // low target
        )
        ) { 
          
          // listener 제거
          CheckBalance.removeListener(check);

          // 매도주문 - 시장가
          const resForSell = await OrderCache({
            body: {
              BUY: false, 
              PDNO: this.orderInfo.pdno,
              ORD_QTY: String(count),
              ORD_DVSN: '01', // 01: 시장가
              ORD_UNPR: '0', 
            },
          });
    
          if (resForSell.rt_cd !== '0') {
            this.processError(`매도주문 실패\n${resForSell.msg1}`);
            return;
          }

          // sell wait 으로..
          this.sellWaiting();
        }

      };

      CheckBalance.addListener(check);

      this.sellAmtHigh = Number(highAmt);
      this.sellAmtLow = Number(lowAmt);

      this.stateMessage = `매도 타겟 : high:${highAmt} / low:${lowAmt}`;
      
    } else {
      this.processError('주문정보 조회 실패');
    }

  }

  sellWaiting(): void {
    
    this.state = 'sell-waiting';
    this.stateMessage = '시장가 매도중';
    const check:CheckBalanceListener = async (data) => {
      if (!hasBalance(data, this.code)) { // 판매완료인 경우 완료처리
        this.done();
        CheckBalance.removeListener(check);
      }
    };
    CheckBalance.addListener(check);
    
  }

  done(): void {
    this.state = 'done';
    this.stateMessage = '(종료) 판매완료';
    removeOrderToday(); // 오늘 주문내역을 초기화 해서 다음 주문으로 이어지도록 처리
  }

  toString() {
    return `${super.toString()} ${this.sellAmtHigh > 0 ? `high:${this.sellAmtHigh} / low:${this.sellAmtLow}` : ''}`;
  }

}

// 현재가 체크
const checkTargetBalance = (data: ResponseInquireBalance[], code:string, targetAmt:number, high:boolean) => {
  const [ filtered ] = data.filter((item) => item.pdno === code);

  // 잔고가 0 이상인지 체크
  return !!(filtered && (high ? Number(filtered.prpr) >= targetAmt : Number(filtered.prpr) <= targetAmt));
};

// 주식 잔고 조회
const getBalance = (data: ResponseInquireBalance[], code:string) => {
  const [ filtered ] = data.filter((item) => item.pdno === code);

  // 잔고가 0 이상인지 체크
  return filtered && Number(filtered.hldg_qty) > 0 ? filtered : undefined;
};

// 주식 잔고 존재 체크
const hasBalance = (data: ResponseInquireBalance[], code:string) => (!!getBalance(data, code));