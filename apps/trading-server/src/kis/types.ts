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
  // 가수도정산금액 - 현재 보유 포지션에 묶인 금액을 뺀 실사용 가능 현금. dnca_tot_amt(예수금총금액)는
  // 보유종목과 무관하게 고정돼 있어 "지금 새로 매수 가능한 돈"으로 쓰기엔 부적합해서 이 필드를 쓴다
  // (2026-08-03 모의계좌 실측으로 확인). 실전 계좌에서도 동일 필드가 채워지는지는 아직 미검증 -
  // 실전 전환 전 반드시 재확인할 것 (kis/trading.ts의 다른 실전/모의 필드 차이 사례 참고).
  prvs_rcdl_excc_amt?: string;
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

// [국내주식] 등락률 순위 [v1_국내주식-088]. 종목코드 필드명이 다른 순위류 API와 다르게
// stck_shrn_iscd 인 점 주의 (volume-rank/vi-status/foreign-institution은 mksc_shrn_iscd).
export interface FluctuationItem {
  hts_kor_isnm: string; // 종목명
  stck_shrn_iscd: string; // 종목코드
  stck_prpr: string; // 현재가
  prdy_ctrt: string; // 전일 대비율 (현재가 vs 전일종가)
  oprc_vrss_prpr_rate: string; // 시가 대비 현재가 비율 (현재가 vs 시가) - 시가 역산에 사용
  acml_vol: string; // 누적거래량
}