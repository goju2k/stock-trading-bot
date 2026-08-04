import { assertKisSuccess, getKisClient } from './client';
import { getKisEnvConfig } from './env';
import { TR_ID, balancePath } from './tr-id';
import {
  InquireBalanceItem,
  InquireBalanceSummary,
  KisResponse,
  KisResponseMulti,
  OrderCacheResponseOutput,
} from './types';

// KIS 공식 예제(inquire_balance.py) 기준 1회 호출당 최대 건수: 실전 50건 / 모의 20건 - 이후는
// 연속조회(tr_cont 헤더 + CTX_AREA_FK100/NK100)로 넘겨받아야 한다. 안 따라가면 이 캡을 넘는
// 계좌는 뒤 페이지 종목이 BalancePoller/PositionWatcher/forceSell 전부에서 통째로 안 보인다
// (2026-08-04 사고: VI모멘텀 매수가 하루종일 쌓이며 모의계좌 동시 보유종목이 20건을 넘어서자
// 뒤로 밀린 포지션들이 "매수는 됐는데 잔고엔 안 보임" 상태로 방치, 15:25 강제청산도 못 잡음).
const MAX_BALANCE_PAGES = 10;

export async function inquireBalance() {
  const { env, cano } = getKisEnvConfig();
  const client = await getKisClient();

  let holdings: InquireBalanceItem[] = [];
  let summary: InquireBalanceSummary | undefined;
  let fk100 = '';
  let nk100 = '';
  let trCont = '';

  for (let page = 0; page < MAX_BALANCE_PAGES; page += 1) {
    // NOTE: 실전(inquire-balance-rlz-pl)과 모의(inquire-balance)의 요청 파라미터 형태가
    // 동일하다고 가정한다. 모의 계좌로 최초 실행할 때 KIS 응답을 확인해 필드 차이가 있으면 보정할 것.
    // eslint-disable-next-line no-await-in-loop
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
          CTX_AREA_FK100: fk100,
          CTX_AREA_NK100: nk100,
          COST_ICLD_YN: 'Y',
        },
        headers: { tr_id: TR_ID.balance(env), tr_cont: trCont },
      },
    );

    // rt_cd 확인 없이 output1을 바로 읽으면 레이트리밋 등으로 실패한 응답이 "보유종목 0개"로
    // 오인된다 - 2026-08-03 사고(보유 중인 종목들이 한 틱에 전부 "매도됨"으로 오판됨) 원인.
    assertKisSuccess(res.data);

    holdings = holdings.concat(res.data.output1 || []);
    if (!summary) {
      summary = res.data.output2?.[0];
    }

    fk100 = res.data.ctx_area_fk100?.trim() ?? '';
    nk100 = res.data.ctx_area_nk100?.trim() ?? '';
    const respTrCont = res.headers.tr_cont;

    // 다음 페이지 존재 신호(M/F, KIS 공식 예제 기준) + continuation key가 실제로 있을 때만 계속.
    // key가 비어있는데 tr_cont만 M/F인 이상 응답에 대비한 안전장치.
    if ((respTrCont !== 'M' && respTrCont !== 'F') || (!fk100 && !nk100)) {
      break;
    }
    trCont = 'N';
  }

  return { holdings, summary };
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