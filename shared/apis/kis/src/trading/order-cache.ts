import { KisApi } from '../axios-instance';
import envConstants from '../env-constants';
import { KisRequest, KisResponse } from '../types/common';

export interface RequestOrderCache {
  CANO:string;
  ACNT_PRDT_CD:string;
  PDNO:string;
  ORD_DVSN:string;
  ORD_QTY:string;
  ORD_UNPR:string;
  ALGO_NO:string;
}

export interface ResponseOrderCache {
  KRX_FWDG_ORD_ORGNO: string;
  ODNO: string;
  ORD_TMD: string;
}

export type OrderCacheInput = Pick<RequestOrderCache, 'PDNO'> & {BUY: boolean;};

const defaultRequest:Omit<RequestOrderCache, keyof OrderCacheInput> = {
  CANO: envConstants.VITE_KIS_CANO, // 계좌번호
  ACNT_PRDT_CD: '01', // 계좌상품코드
  ORD_DVSN: '01', // 주문구분 01:시장가
  ORD_QTY: '1', // 주문수량
  ORD_UNPR: '0', // 주문금액
  ALGO_NO: '', // 공란
};

export async function OrderCache({ body }:KisRequest<void, OrderCacheInput>) {
  const { BUY, ...requestBody } = body || {};
  const res = await KisApi.instance.post<KisResponse<ResponseOrderCache>>(
    'trading/order-cash',
    { ...defaultRequest, ...requestBody },
    { headers: { tr_id: BUY ? 'TTTC0802U' : 'TTTC0801U' } },
  );
  return res?.data || { output: [] };
}