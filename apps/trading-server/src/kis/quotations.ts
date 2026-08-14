import { assertKisSuccess, getKisClient } from './client';
import { COMMON_TR_ID } from './tr-id';
import { BusinessDayItem, FluctuationItem, ForeignInstitutionItem, IndexPriceItem, KisResponse, NewsTitleItem, ViStatusItem, VolumeRankItem } from './types';

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
        // 0001(코스피 전용, 2026-08-07 실험) -> 0000(전체), 2026-08-13: vi_release를 끄고
        // scanner.ts(거래증가율) 위주로 가면서 원본(kis-catch-stock-hook.tsx) 설정으로 복귀 -
        // 라이브 비교 결과 코스피 한정시 필터 통과 후보가 거의 절반(14개->8개)으로 줄어있었다
        // (코스닥 소형주가 거래증가율 상위에 많이 걸리는데 전부 제외됐었음).
        FID_INPUT_ISCD: '0000',
        FID_DIV_CLS_CODE: '0',
        // 0:평균거래량 1:거래증가율 2:평균거래회전율 3:거래금액순 4:평균거래금액회전율
        // 3(거래대금순) -> 1(거래증가율), 2026-08-13: 최초 버전(1)에서 "실제 돈이 몰리는
        // 종목을 잡자"는 취지로 3으로 바꿨었는데(2026-08-01), 그 뒤 거래량 실적을 보니
        // volume_rank가 하루 0~3건밖에 안 잡혔다(3은 대형주 위주라 targetUpRating 7% 필터를
        // 잘 못 넘김, vi_release와 겹치는 종목도 대부분 vi_release가 먼저 채감). VI는 이미
        // ±10% 움직인 뒤에야 발동하므로, 거래증가율 기준으로 그 전에 먼저 잡으면 vi_release보다
        // 더 싼 가격에 진입할 수 있다는 판단 - 같은 종목 동시매수는 execute-buy.ts의 buyLocks로
        // 이미 막혀있어 두 전략이 경쟁해도 안전하다.
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
  assertKisSuccess(res.data);
  return res.data.output || [];
}

// 오늘(YYYYMMDD) 변동성완화장치(VI) 발동/해제 현황 - 정적 VI만(상승, 아래 파라미터 참고).
export async function fetchViStatus(baseDate: string) {
  const client = await getKisClient();
  const res = await client.get<KisResponse<ViStatusItem[]>>(
    'uapi/domestic-stock/v1/quotations/inquire-vi-status',
    {
      params: {
        FID_DIV_CLS_CODE: '1', // 0:전체 1:상승 2:하락
        FID_COND_SCR_DIV_CODE: '20139',
        // 0(전체) -> K(거래소/코스피): 매수 대상을 코스피로 한정하는 실험(scanner.ts와 동일 이유).
        FID_MRKT_CLS_CODE: 'K',
        FID_INPUT_ISCD: '',
        // 0:전체 1:정적 2:동적 3:정적&동적. 정적(기준가 대비 ±10%)만 받는다 - 동적(±2~3%)까지
        // 섞으면 진짜 큰 변동 없이도 걸리는 잡음성 신호가 많이 들어온다(2026-08-07 확인: 6~7%
        // 스파이크 꼭대기에서 매수해 되돌림에 손절당하는 패턴이 반복됨 - 동적 VI 규모로 추정).
        FID_RANK_SORT_CLS_CODE: '1',
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

// 국내업종 현재지수 (코스피 등). 시장 레짐 필터(market-condition.ts)가 하락장에 전체 스캔을
// 멈추는 데 쓴다. iscd 예: 코스피 0001, 코스닥 1001, 코스피200 2001.
export async function fetchIndexPrice(iscd: string) {
  const client = await getKisClient();
  const res = await client.get<KisResponse<IndexPriceItem>>(
    'uapi/domestic-stock/v1/quotations/inquire-index-price',
    {
      params: {
        FID_COND_MRKT_DIV_CODE: 'U',
        FID_INPUT_ISCD: iscd,
      },
      headers: { tr_id: COMMON_TR_ID.indexPrice },
    },
  );
  assertKisSuccess(res.data);
  return res.data.output;
}

// 종목 관련 최근 뉴스/공시 제목 목록. FID_INPUT_ISCD로 넘겨도 응답이 그 종목만 깔끔하게
// 걸러주지 않아서(2026-08-14 라이브 확인 - 다른 종목 기사도 섞여 나옴), 호출부에서 반환된
// 각 항목의 iscd1~iscd10을 직접 확인해서 원하는 코드가 포함된 것만 골라 써야 한다.
export async function fetchNewsTitle(code: string) {
  const client = await getKisClient();
  const res = await client.get<KisResponse<NewsTitleItem[]>>(
    'uapi/domestic-stock/v1/quotations/news-title',
    {
      params: {
        FID_NEWS_OFER_ENTP_CODE: '',
        FID_COND_MRKT_CLS_CODE: 'J',
        FID_INPUT_ISCD: code,
        FID_TITL_CNTT: '',
        FID_INPUT_DATE_1: '',
        FID_INPUT_HOUR_1: '',
        FID_RANK_SORT_CLS_CODE: '',
        FID_INPUT_SRNO: '',
      },
      headers: { tr_id: COMMON_TR_ID.newsTitle },
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