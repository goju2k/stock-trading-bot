export interface KisRequest<T, B> {
  params?:T;
  body?:B;
}

export interface KisResponse<T> {
  rt_cd:string;
  msg_cd:string;
  msg1:string;
  output:T;
}