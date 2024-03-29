import { ResponseInquireBalance } from '@shared/apis/kis';

export abstract class TradingStrategy {
  
  // 종목 코드
  code!: string;

  // 주문 정보
  orderInfo?:ResponseInquireBalance;
  
  // 처리 상태
  // 'checking' : 매수 완료됐는지 체크
  // 'sell-order' : 수익/손해 퍼센티지에 따라 각각 매도 주문
  // 'sell-waiting' : 매도 완료됐는지 체크
  // 'done' : 완료
  // 'error' : 처리중 오류
  state: 'checking'|'watching-for-sell'|'sell-waiting'|'done'|'error' = 'checking';
  
  sellAmtHigh:number = 0;

  sellAmtLow:number = 0;
  
  highOrLow:'high'|'low'|'' = '';

  // 처리 메시지
  stateMessage?: string = '';

  constructor(code: string) {
    this.code = code;
  }

  process() {
    this.checking();
  }

  processError(message:string) {
    this.state = 'error';
    this.stateMessage = message;
  }

  abstract checking():void;

  abstract sellOrder():void;

  abstract sellWaiting():void;

  abstract done():void;
  
  toString() {
    return `종목:[${this.code}] 처리상태:[${this.state}] ${this.stateMessage}`;
  }

}