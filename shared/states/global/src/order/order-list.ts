import { atom } from 'recoil';

import { TradingStrategy } from './abstract/trading-strategy';

import { OrderListStore } from '../local-store/local-store';

export interface OrderListInterface {
  date:string;
  stocks:string[];
  trading:TradingStrategy[];
}

export const OrderDate = atom<string>({
  key: 'order-list/date',
  default: '',
});

export const OrderStocks = atom<string[]>({
  key: 'order-list/stocks',
  default: OrderListStore.get(),
});

export const OrderTrading = atom<TradingStrategy[]>({
  key: 'order-list/trading',
  default: [],
});