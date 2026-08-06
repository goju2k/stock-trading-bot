import { fetchIndexPrice } from '../kis';

const REFRESH_INTERVAL_MS = 60 * 1000; // 지수가 틱마다 바뀌긴 하지만 스캐너 판단용으론 1분이면 충분
const KOSPI_ISCD = '0001';

// 코스피 전일대비 상승중일 때만 신규 스캔을 허용한다 - 롱온리 모멘텀 전략(거래대금순위/VI상승/
// 시가갭) 셋 다 "지금 강한 종목은 계속 강할 것"이 전제라, 지수 자체가 하락 중이면 개별 종목의
// 강세도 시장 하방에 같이 끌려갈 확률이 높고 세 전략이 전부 같은 방향에 베팅하고 있어 분산 효과가
// 없다(2026-08-06 하락장에서 vi_release/gap_up 둘 다 큰 손실 확인 후 도입).
// 조회 실패시엔 직전 상태를 유지한다 - 이 캐시 하나가 또 다른 단일장애점이 돼서 지수 조회
// 문제만으로 하루 전체 매매가 막히는 걸 원치 않는다(fetchStartingCash 등과 같은 원칙).
let bullish = true; // 최초 조회 전 기본값 - 안전 쪽(false)이 아니라 허용 쪽으로 시작
let timer: NodeJS.Timeout | undefined;

async function refresh() {
  try {
    const item = await fetchIndexPrice(KOSPI_ISCD);
    const pctChange = Number(item?.bstp_nmix_prdy_ctrt);
    if (!Number.isFinite(pctChange)) {
      console.error('[market-condition] invalid bstp_nmix_prdy_ctrt in response - keeping previous state', item);
      return;
    }
    bullish = pctChange > 0;
    console.log(`[market-condition] KOSPI ${pctChange}% -> ${bullish ? '상승(스캔 허용)' : '하락/보합(스캔 중단)'}`);
  } catch (error) {
    console.error('[market-condition] refresh failed - keeping previous state', error);
  }
}

export function startMarketConditionCache() {
  if (timer) return;
  const loop = async () => {
    await refresh();
    timer = setTimeout(loop, REFRESH_INTERVAL_MS);
  };
  loop();
}

export function stopMarketConditionCache() {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  bullish = true;
}

export function isMarketBullish() {
  return bullish;
}