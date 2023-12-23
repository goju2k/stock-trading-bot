export interface KisRequest<T, B> {
  params?:T;
  body?:B;
}

interface KisResponseBase {
  rt_cd:string;
  msg_cd:string;
  msg1:string;
}

export interface KisResponse<OUTPUT> extends KisResponseBase {
  output:OUTPUT;
}

export interface KisResponseMulti<OUTPUT1 = void, OUTPUT2 = void> extends KisResponseBase {
  output1:OUTPUT1;
  output2:OUTPUT2;
}