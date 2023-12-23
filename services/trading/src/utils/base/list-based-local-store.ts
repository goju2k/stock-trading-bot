export class ListBasedLocalStore {
  
  key:string;

  constructor(key:string) {
    this.key = key;
  }
  
  includes(stock:string) {
    return this.get().includes(stock);
  }

  get() {
    const orderList = window.localStorage.getItem(this.key);
    if (orderList) {
      return JSON.parse(orderList) as string[];
    }
    return [];
  }

  set(stock:string) {
    const list = this.get();
    if (!list.includes(stock)) {
      list.push(stock);
    }
    window.localStorage.setItem(this.key, JSON.stringify(list));
  }

  setAll(stocks:string[]) {
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