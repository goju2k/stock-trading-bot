import { atom } from 'recoil';

export interface OrderListInterface {
  date:string;
  stocks:string[];
}

export const OrderList = atom<OrderListInterface>({
  key: 'order-list',
  default: { date: '', stocks: [] },
});