import { getKisClient } from './client';
import { COMMON_TR_ID } from './tr-id';
import { BusinessDayItem, ForeignInstitutionItem, KisResponse, ViStatusItem, VolumeRankItem } from './types';

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
  return res.data.output || [];
}

// 기준일자(YYYYMMDD)의 개장여부 조회
export async function fetchBusinessDay(baseDate: string) {
  const client = await getKisClient();
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
  return res.data.output?.[0];
}