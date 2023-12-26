import { atom } from 'recoil';

import { TradingStrategy } from './abstract/trading-strategy';

import { OrderListStore } from '../local-store/local-store';

export interface OrderListInterface {
  date:string;
  stocks:string[];
  trading:TradingStrategy[];
}

export const OrderList = atom<OrderListInterface>({
  key: 'order-list',
  default: { date: '', stocks: OrderListStore.get(), trading: [] },
  dangerouslyAllowMutability: true,
});