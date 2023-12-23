export class ListBasedLocalStore<T> {
  
  key:string;

  constructor(key:string) {
    this.key = key;
  }
  
  includes(stock:T) {
    return this.get().includes(stock);
  }

  get() {
    const orderList = window.localStorage.getItem(this.key);
    if (orderList) {
      return JSON.parse(orderList) as T[];
    }
    return [];
  }

  set(stock:T) {
    const list = this.get();
    if (!list.includes(stock)) {
      list.push(stock);
    }
    window.localStorage.setItem(this.key, JSON.stringify(list));
  }

  setAll(stocks:T[]) {
    const list = this.get();
    stocks.forEach((stock) => {
      if (!list.includes(stock)) {
        list.push(stock);
      }
    });
    window.localStorage.setItem(this.key, JSON.stringify(list));
  }

  removeAll() {
    window.localStorage.removeItem(this.key);
  }

}