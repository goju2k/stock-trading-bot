import { KisApiInstance } from '../axios-instance';
import { KisResponse } from '../types/common';

export interface RequestVolumeRank {
  FID_COND_MRKT_DIV_CODE:string;
  FID_COND_SCR_DIV_CODE:string;
  FID_INPUT_ISCD:string;
  FID_DIV_CLS_CODE:string;
  FID_BLNG_CLS_CODE:string;
  FID_TRGT_CLS_CODE:string;
  FID_TRGT_EXLS_CLS_CODE:string;
  FID_INPUT_PRICE_1:number;
  FID_INPUT_PRICE_2:number;
  FID_VOL_CNT:number;
  FID_INPUT_DATE_1:string;
}

export interface ResponseVolumeRank {
  hts_kor_isnm: string;
  mksc_shrn_iscd: string;
  data_rank: string;
  stck_prpr: string;
  prdy_vrss_sign: string;
  prdy_vrss: string;
  prdy_ctrt: string;
  acml_vol: string;
  prdy_vol: string;
  lstn_stcn: string;
  avrg_vol: string;
  n_befr_clpr_vrss_prpr_rate: string;
  vol_inrt: string;
  vol_tnrt: string;
  nday_vol_tnrt: string;
  avrg_tr_pbmn: string;
  tr_pbmn_tnrt: string;
  nday_tr_pbmn_tnrt: string;
  acml_tr_pbmn: string;
}

export type VolumeRankInput = Pick<RequestVolumeRank, 'FID_INPUT_PRICE_1'|'FID_INPUT_PRICE_2'|'FID_VOL_CNT'>;

const defaultRequest:Omit<RequestVolumeRank, keyof VolumeRankInput> = {
  FID_COND_MRKT_DIV_CODE: 'J',
  FID_COND_SCR_DIV_CODE: '20171',
  FID_INPUT_ISCD: '0000',
  FID_DIV_CLS_CODE: '0',
  FID_BLNG_CLS_CODE: '1',
  FID_TRGT_CLS_CODE: '111111111',
  FID_TRGT_EXLS_CLS_CODE: '000000',
  FID_INPUT_DATE_1: '',
};

export function VolumeRank(request:VolumeRankInput) {
  return KisApiInstance.get<RequestVolumeRank, KisResponse<ResponseVolumeRank>>(
    'quotations/volume-rank',
    {
      params: { ...defaultRequest, ...request },
      headers: { tr_id: 'FHPST01710000' },
    },
  );
}