function padNumber(value:number|string, count:number) {
  let string = String(value);
  Array.from(Array(count - string.length)).forEach(() => string = `0${string}`);
  return string;
}

function getYYYYMMDD(date:Date, delimeter?:string) {
  const yyyy = date.getFullYear();
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  return `${yyyy}${delimeter || ''}${padNumber(mm, 2)}${delimeter || ''}${padNumber(dd, 2)}`;
}

function getToday(delimeter?:string) {
  return getYYYYMMDD(new Date(), delimeter);
}

function getHHMi(date:Date, delimeter?:string) {
  const hh = date.getHours();
  const mm = date.getMinutes();
  return `${padNumber(hh, 2)}${delimeter || ''}${padNumber(mm, 2)}`;
}

function getTodayHHMi(delimeter?:string) {
  return getHHMi(new Date(), delimeter);
}

function getHHMiSS(date:Date, delimeter?:string) {
  const hh = date.getHours();
  const mm = date.getMinutes();
  const ss = date.getSeconds();
  return `${padNumber(hh, 2)}${delimeter || ''}${padNumber(mm, 2)}${delimeter || ''}${padNumber(ss, 2)}`;
}

function getTodayHHMiSS(delimeter?:string) {
  return getHHMiSS(new Date(), delimeter);
}

export const DateUtil = {
  getToday,
  getYYYYMMDD,
  getHHMi,
  getTodayHHMi,
  getHHMiSS,
  getTodayHHMiSS,
};