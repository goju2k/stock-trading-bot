import { KisApi } from '../axios-instance';
import { KisRequest, KisResponse } from '../types/common';

export interface RequestBusinessDay {
  BASS_DT:string;
  CTX_AREA_NK:string;
  CTX_AREA_FK:string;
}

export interface ResponseBusinessDay {
  bass_dt: string;
  wday_dvsn_cd: string;
  bzdy_yn: string;
  tr_day_yn: string;
  opnd_yn: string;
  sttl_day_yn: string;
}

export type BusinessDayInput = Pick<RequestBusinessDay, 'BASS_DT'>;

export async function BusinessDay({ params }:KisRequest<BusinessDayInput, void>) {
  const mixedParams = {
    BASS_DT: params?.BASS_DT,
    CTX_AREA_NK: '',
    CTX_AREA_FK: '',
  };
  const res = await KisApi.instance.get<KisResponse<ResponseBusinessDay[]>>(
    'quotations/chk-holiday',
    {
      params: mixedParams,
      headers: { tr_id: 'CTCA0903R' },
    },
  );
  return res?.data || { output: [] };
}