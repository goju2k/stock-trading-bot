import { assertKisSuccess, getKisClient } from './client';
import { COMMON_TR_ID } from './tr-id';
import { BusinessDayItem, FluctuationItem, ForeignInstitutionItem, KisResponse, ViStatusItem, VolumeRankItem } from './types';

export interface VolumeRankFilter {
  minPrice: number;
  maxPrice: number;
  minVolume: number;
}

export async function fetchVolumeRank(filter: VolumeRankFilter) {
  const client = await getKisClient();
  const res = await client.get<KisResponse<VolumeRankItem[]>>(
    'uapi/domestic-stock/v1/quotations/volume-rank',
    {
      params: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_COND_SCR_DIV_CODE: '20171',
        FID_INPUT_ISCD: '0000',
        FID_DIV_CLS_CODE: '0',
        // 0:평균거래량 1:거래증가율 2:평균거래회전율 3:거래금액순 4:평균거래금액회전율
        // 순수 거래량 급증(1) 대신 실제 돈이 몰리는 거래대금순(3)으로 스캔 기준 교체.
        FID_BLNG_CLS_CODE: '3',
        FID_TRGT_CLS_CODE: '111111111',
        FID_TRGT_EXLS_CLS_CODE: '000000',
        FID_INPUT_DATE_1: '',
        FID_INPUT_PRICE_1: filter.minPrice,
        FID_INPUT_PRICE_2: filter.maxPrice,
        FID_VOL_CNT: filter.minVolume,
      },
      headers: { tr_id: COMMON_TR_ID.volumeRank },
    },
  );
  assertKisSuccess(res.data);
  return res.data.output || [];
}

// 오늘(YYYYMMDD) 변동성완화장치(VI) 발동/해제 현황 전체 목록
export async function fetchViStatus(baseDate: string) {
  const client = await getKisClient();
  const res = await client.get<KisResponse<ViStatusItem[]>>(
    'uapi/domestic-stock/v1/quotations/inquire-vi-status',
    {
      params: {
        FID_DIV_CLS_CODE: '0', // 0:전체 1:상승 2:하락
        FID_COND_SCR_DIV_CODE: '20139',
        FID_MRKT_CLS_CODE: '0', // 0:전체 K:거래소 Q:코스닥
        FID_INPUT_ISCD: '',
        FID_RANK_SORT_CLS_CODE: '0', // 0:전체 1:정적 2:동적 3:정적&동적
        FID_INPUT_DATE_1: baseDate,
        FID_TRGT_CLS_CODE: '',
        FID_TRGT_EXLS_CLS_CODE: '',
      },
      headers: { tr_id: COMMON_TR_ID.viStatus },
    },
  );
  assertKisSuccess(res.data);
  return res.data.output || [];
}

// 오늘 외국인+기관계 합산 순매수 상위 종목 (증권사 직원이 장중 특정 시각에만 집계 입력하는
// 데이터라 실시간이 아님 - foreign-institution-cache.ts에서 몇 분 간격으로만 갱신해서 쓴다).
export async function fetchForeignInstitutionNetBuyTop() {
  const client = await getKisClient();
  const res = await client.get<KisResponse<ForeignInstitutionItem[]>>(
    'uapi/domestic-stock/v1/quotations/foreign-institution-total',
    {
      params: {
        FID_COND_MRKT_DIV_CODE: 'V',
        FID_COND_SCR_DIV_CODE: '16449',
        FID_INPUT_ISCD: '0000', // 0000: 전체
        FID_DIV_CLS_CODE: '0', // 0:수량정렬 1:금액정렬
        FID_RANK_SORT_CLS_CODE: '0', // 0:순매수상위 1:순매도상위
        FID_ETC_CLS_CODE: '0', // 0:전체(외국인+기관계+기타)
      },
      headers: { tr_id: COMMON_TR_ID.foreignInstitutionTotal },
    },
  );
  assertKisSuccess(res.data);
  return res.data.output || [];
}

// 등락률 순위 (시가 갭 상승 스캔용). 개별 종목 시세 API 없이도 시가를 역산할 수 있게
// prdy_ctrt(전일종가 대비)와 oprc_vrss_prpr_rate(시가 대비)를 같이 반환한다.
export async function fetchFluctuationRank(filter: VolumeRankFilter) {
  const client = await getKisClient();
  const res = await client.get<KisResponse<FluctuationItem[]>>(
    'uapi/domestic-stock/v1/ranking/fluctuation',
    {
      params: {
        fid_cond_mrkt_div_code: 'J',
        fid_cond_scr_div_code: '20170',
        fid_input_iscd: '0000',
        fid_rank_sort_cls_code: '0', // 0:상승율순
        fid_input_cnt_1: '0',
        fid_prc_cls_code: '0',
        fid_input_price_1: filter.minPrice,
        fid_input_price_2: filter.maxPrice,
        fid_vol_cnt: filter.minVolume,
        fid_trgt_cls_code: '0',
        fid_trgt_exls_cls_code: '0',
        fid_div_cls_code: '0',
        fid_rsfl_rate1: '',
        fid_rsfl_rate2: '',
      },
      headers: { tr_id: COMMON_TR_ID.fluctuation },
    },
  );
  assertKisSuccess(res.data);
  return res.data.output || [];
}

// 기준일자(YYYYMMDD)의 개장여부 조회.
// NOTE: 모의투자 계좌로 실제 호출해보니 EGW02006("모의투자 TR 이 아닙니다")로 거부됨 -
// 개장일 여부는 계좌와 무관한 공개 시장정보인데 이 TR 자체가 모의투자에서 지원 안 되는 것으로
// 확인됨. 그래서 현재 거래 모드(KIS_ENV)와 무관하게 항상 real 자격증명으로 호출한다
// (KIS_REAL_* 가 반드시 설정돼 있어야 함 - paper 전용으로만 쓰더라도 필요).
export async function fetchBusinessDay(baseDate: string) {
  const client = await getKisClient('real');
  const res = await client.get<KisResponse<BusinessDayItem[]>>(
    'uapi/domestic-stock/v1/quotations/chk-holiday',
    {
      params: {
        BASS_DT: baseDate,
        CTX_AREA_NK: '',
        CTX_AREA_FK: '',
      },
      headers: { tr_id: COMMON_TR_ID.businessDay },
    },
  );
  // 실패를 조용히 undefined로 넘기면 openTodaySession()이 "휴장일"로 오판해서 그날 하루
  // 자동매매가 통째로 안 열린다 - 반드시 검증해서 실패는 실패로 드러나게 한다.
  assertKisSuccess(res.data);
  return res.data.output?.[0];
}