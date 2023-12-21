import { atom } from 'recoil';
import { TradingStrategy } from 'services/trading/src/trading-strategy/abstract/trading-strategy';

export interface OrderListInterface {
  date:string;
  stocks:string[];
  trading:TradingStrategy[];
}

export const OrderList = atom<OrderListInterface>({
  key: 'order-list',
  default: { date: '', stocks: [], trading: [] },
});