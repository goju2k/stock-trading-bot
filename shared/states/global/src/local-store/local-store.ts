import { DateUtil } from '@shared/utils/date';
import { ListBasedLocalStore } from '@shared/utils/localstorage';
import { atom, useRecoilState } from 'recoil';

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

/**
 * 오늘 주문이력
 */
export const OrderListStore = new ListBasedLocalStore<string>('order-list');

/**
 * 오늘 주문대상에서 제외된 목록
 */
export const PassedListStore = new ListBasedLocalStore<string>('passed-list');
let defaultPassedValues = PassedListStore.get();
if (!defaultPassedValues) {
  defaultPassedValues = [];
}

export const PassedList = atom<string[]>({
  key: 'passed-list',
  default: defaultPassedValues,
  effects: [
    ({ onSet }) => {
      onSet((newValue, _, isReset) => {
        !isReset && PassedListStore.setAll(newValue);
      });
    },
  ],
});

export function useAddPassedList() {
  const [ state, setState ] = useRecoilState(PassedList);
  return (stocks:string|string[]) => {
    stocks = Array.isArray(stocks) ? stocks : [ stocks ];
    stocks.forEach((stock) => {
      if (!state.includes(stock)) {
        state.push(stock);
      }
    });
    setState([ ...state ]);
  };
}