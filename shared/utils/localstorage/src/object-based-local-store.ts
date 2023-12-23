export class ObjectBasedLocalStore<T extends Object> {
  
  key:string;

  constructor(key:string) {
    this.key = key;
  }
  
  hasValue(name:keyof T, value:T[keyof T]) {
    return this.getValue(name) === value;
  }

  get():T {
    const orderList = window.localStorage.getItem(this.key);
    if (orderList) {
      return JSON.parse(orderList) as T;
    }
    return {} as T;
  }

  getValue(name:keyof T) {
    return this.get()[name];
  }

  set(object:T) {
    window.localStorage.setItem(this.key, JSON.stringify(object));
  }

  setValue(name:keyof T, value:T[keyof T]) {
    const object = this.get();
    object[name] = value;
    window.localStorage.setItem(this.key, JSON.stringify(object));
  }
  
  removeAll() {
    window.localStorage.removeItem(this.key);
  }

}