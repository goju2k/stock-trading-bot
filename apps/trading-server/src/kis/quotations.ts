import { getKisClient } from './client';
import { COMMON_TR_ID } from './tr-id';
import { BusinessDayItem, KisResponse, VolumeRankItem } from './types';

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
        FID_BLNG_CLS_CODE: '1',
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