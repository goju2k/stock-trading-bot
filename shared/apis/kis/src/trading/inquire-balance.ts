import { KisApi } from '../axios-instance';
import envConstants from '../env-constants';
import { KisResponse } from '../types/common';

export interface RequestInquireBalance {
  CANO:string; // 종합계좌번호 String Y 8 계좌번호 체계(8-2)의 앞 8자리
  ACNT_PRDT_CD:string; // 계좌상품코드 String Y 2 계좌번호 체계(8-2)의 뒤 2자리
  AFHR_FLPR_YN:string; // 시간외단일가여부 String Y 1 N : 기본값
  OFL_YN:string; // 오프라인여부 String Y 1 공란(Default)
  INQR_DVSN:string; // 조회구분 String Y 2 01 : 대출일별
  UNPR_DVSN:string; // 단가구분 String Y 2 01 : 기본값
  FUND_STTL_ICLD_YN:string; // 펀드결제분포함여부 String Y 1 N : 포함하지 않음
  FNCG_AMT_AUTO_RDPT_YN:string; // 융자금액자동상환여부 String Y 1 N : 기본값
  PRCS_DVSN:string; // 처리구분 String Y 2 00 : 전일매매포함
  CTX_AREA_FK100:string; // 연속조회검색조건100 String Y 100 공란 : 최초 조회시
  CTX_AREA_NK100:string; // 연속조회키100 String Y 100 공란 : 최초 조회시
}

export interface ResponseInquireBalance {
  pdno: string; // 종목
  prdt_name: string; // 종목명
  hldg_qty: string; // 보유수량
  prpr: string; // 현재가
  pchs_avg_pric: string; // 매입평균가격
  evlu_pfls_rt: string; // 평가손익율
  evlu_erng_rt: string; // 평가수익율
}

const defaultRequest:RequestInquireBalance = {
  CANO: envConstants.VITE_KIS_CANO, // 종합계좌번호 String Y 8 계좌번호 체계(8-2)의 앞 8자리
  ACNT_PRDT_CD: '01', // 계좌상품코드 String Y 2 계좌번호 체계(8-2)의 뒤 2자리
  AFHR_FLPR_YN: 'N', // 시간외단일가여부 String Y 1 N : 기본값
  OFL_YN: '', // 오프라인여부 String Y 1 공란(Default)
  INQR_DVSN: '02', // 조회구분 String Y 2 01 : 대출일별 02 : 종목별
  UNPR_DVSN: '01', // 단가구분 String Y 2 01 : 기본값
  FUND_STTL_ICLD_YN: 'N', // 펀드결제분포함여부 String Y 1 N : 포함하지 않음
  FNCG_AMT_AUTO_RDPT_YN: 'N', // 융자금액자동상환여부 String Y 1 N : 기본값
  PRCS_DVSN: '01', // 처리구분 String Y 2 00 : 전일매매포함 01 : 전일매매미포함
  CTX_AREA_FK100: '', // 연속조회검색조건100 String Y 100 공란 : 최초 조회시
  CTX_AREA_NK100: '', // 연속조회키100 String Y 100 공란 : 최초 조회시
};

export async function InquireBalance() {
  const res = await KisApi.instance.get<KisResponse<ResponseInquireBalance[]>>(
    'trading/inquire-balance',
    {
      params: defaultRequest,
      headers: { tr_id: 'TTTC8434R' },
    },
  );
  return res?.data || { output: [] };
}