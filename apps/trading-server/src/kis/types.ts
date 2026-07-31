export interface KisResponseBase {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
}

export interface KisResponse<OUTPUT> extends KisResponseBase {
  output: OUTPUT;
}

export interface KisResponseMulti<OUTPUT1 = void, OUTPUT2 = void> extends KisResponseBase {
  output1: OUTPUT1;
  output2: OUTPUT2;
}

export interface VolumeRankItem {
  hts_kor_isnm: string; // 종목명
  mksc_shrn_iscd: string; // 종목코드
  stck_prpr: string; // 현재가
  prdy_ctrt: string; // 전일대비율
  vol_inrt: string; // 거래량증가율
  acml_vol: string; // 누적거래량
}

export interface BusinessDayItem {
  bass_dt: string;
  opnd_yn: string; // 개장여부 Y/N
}

export interface InquireBalanceItem {
  pdno: string; // 종목코드
  prdt_name: string; // 종목명
  hldg_qty: string; // 보유수량
  prpr: string; // 현재가
  pchs_avg_pric: string; // 매입평균가격
  evlu_pfls_rt: string; // 평가손익율
  evlu_erng_rt: string; // 평가수익율
  evlu_pfls_amt: string; // 평가손익금액
}

// 실전(inquire-balance-rlz-pl)에서만 채워짐. 모의투자(inquire-balance)는 undefined.
export interface InquireBalanceSummary {
  rlzt_pfls?: string; // 실현손익
  rlzt_erng_rt?: string; // 실현손익율
}

export interface OrderCacheResponseOutput {
  KRX_FWDG_ORD_ORGNO: string;
  ODNO: string;
  ORD_TMD: string;
}

// [국내주식] 변동성완화장치(VI) 현황 [v1_국내주식-055]
export interface ViStatusItem {
  hts_kor_isnm: string; // 종목명
  mksc_shrn_iscd: string; // 종목코드
  vi_cls_code: string; // VI발동상태
  bsop_date: string; // 영업일자
  cntg_vi_hour: string; // VI발동시간 (HHMMSS)
  vi_cncl_hour: string; // VI해제시간 (HHMMSS, 발동중이면 공란)
  vi_kind_code: string; // VI종류코드
  vi_prc: string; // VI발동가격
  vi_stnd_prc: string; // 정적VI발동기준가격
  vi_dprt: string; // 정적VI발동괴리율
  vi_count: string; // VI발동횟수
}

// [국내주식] 국내기관_외국인 매매종목가집계 [국내주식-037]
export interface ForeignInstitutionItem {
  hts_kor_isnm: string; // 종목명
  mksc_shrn_iscd: string; // 종목코드
  ntby_qty: string; // 순매수 수량 (합계)
  stck_prpr: string; // 현재가
  frgn_ntby_qty: string; // 외국인 순매수 수량
  orgn_ntby_qty: string; // 기관계 순매수 수량
}