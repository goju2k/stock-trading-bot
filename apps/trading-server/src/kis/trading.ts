import { getKisClient } from './client';
import { getKisEnvConfig } from './env';
import { TR_ID, balancePath } from './tr-id';
import {
  InquireBalanceItem,
  InquireBalanceSummary,
  KisResponse,
  KisResponseMulti,
  OrderCacheResponseOutput,
} from './types';

export async function inquireBalance() {
  const { env, cano } = getKisEnvConfig();
  const client = await getKisClient();

  // NOTE: 실전(inquire-balance-rlz-pl)과 모의(inquire-balance)의 요청 파라미터 형태가
  // 동일하다고 가정한다. 모의 계좌로 최초 실행할 때 KIS 응답을 확인해 필드 차이가 있으면 보정할 것.
  const res = await client.get<KisResponseMulti<InquireBalanceItem[], InquireBalanceSummary[]>>(
    `uapi/domestic-stock/v1/${balancePath(env)}`,
    {
      params: {
        CANO: cano,
        ACNT_PRDT_CD: '01',
        AFHR_FLPR_YN: 'N',
        OFL_YN: '',
        INQR_DVSN: '01',
        UNPR_DVSN: '01',
        FUND_STTL_ICLD_YN: 'N',
        FNCG_AMT_AUTO_RDPT_YN: 'N',
        PRCS_DVSN: '01',
        CTX_AREA_FK100: '',
        CTX_AREA_NK100: '',
        COST_ICLD_YN: 'Y',
      },
      headers: { tr_id: TR_ID.balance(env) },
    },
  );

  return {
    holdings: res.data.output1 || [],
    summary: res.data.output2?.[0],
  };
}

export interface PlaceOrderInput {
  buy: boolean;
  code: string; // PDNO
  qty: string; // ORD_QTY
}

export async function placeMarketOrder({ buy, code, qty }: PlaceOrderInput) {
  const { env, cano } = getKisEnvConfig();
  const client = await getKisClient();

  const res = await client.post<KisResponse<OrderCacheResponseOutput>>(
    'uapi/domestic-stock/v1/trading/order-cash',
    {
      CANO: cano,
      ACNT_PRDT_CD: '01',
      PDNO: code,
      ORD_DVSN: '01', // 01: 시장가
      ORD_QTY: qty,
      ORD_UNPR: '0',
      ALGO_NO: '',
    },
    { headers: { tr_id: buy ? TR_ID.buy(env) : TR_ID.sell(env) } },
  );

  return res.data;
}