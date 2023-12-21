import { DateUtil } from '@shared/utils/date';

// today's order
export function getOrderToday() {
  const today = DateUtil.getToday();
  return window.localStorage.getItem(`order-${today}`);
}

export function setOrderToday() {
  const today = DateUtil.getToday();
  window.localStorage.setItem(`order-${today}`, new Date().toString());
}

export function removeOrderToday() {
  const today = DateUtil.getToday();
  window.localStorage.removeItem(`order-${today}`);
}

// ordered list
const orderedListKey = 'order-list';
export function isOrderedStock(stock:string) {
  return getOrderedStock().includes(stock);
}

export function getOrderedStock() {
  const orderList = window.localStorage.getItem(orderedListKey);
  if (orderList) {
    return JSON.parse(orderList) as string[];
  }
  return [];
}

export function setOrderedStock(stock:string) {
  const list = getOrderedStock();
  if (!list.includes(stock)) {
    list.push(stock);
  }
  window.localStorage.setItem(orderedListKey, JSON.stringify(list));
}

export function removeOrderedStock() {
  window.localStorage.removeItem(orderedListKey);
}