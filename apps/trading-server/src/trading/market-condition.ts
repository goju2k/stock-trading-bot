import { fetchIndexPrice } from '../kis';
import { DISCORD_COLOR, sendDiscordMessage } from '../notify/discord';

const REFRESH_INTERVAL_MS = 60 * 1000;
const KOSPI_ISCD = '0001';
// 틱(REFRESH_INTERVAL_MS 간격) 간 순간변화율 기준치(%). 전일종가 대비가 아니라 "직전 틱 대비
// 지금 얼마나 움직였나"를 본다 - 매수세가 실제로 붙어서 오르는 중인지가 중요하지, 그날 지수가
// 절대적으로 플러스인지 마이너스인지는 부차적이다(2026-08-07, 이전 버전의 "전일대비 부호"
// 필터는 아침에 오른 뒤 하루 종일 흘러내리는 장에서 오전 내내 "상승"으로 잘못 판정했다).
const TICK_THRESHOLD_PERCENT = 0.02;
// 틱 하나의 노이즈로 바로 상태를 뒤집지 않고, 같은 방향이 연속으로 나와야 전환한다.
// 2 -> 4 (2026-08-10): 2틱(2분)짜리 확인은 여전히 너무 예민해서 실사용 첫날 하루 41회
// 전환됐다(짧게는 2분 간격) - 매수/매도 게이트가 그 빈도로 계속 뒤집히면 신호로서 의미가
// 없다. TICK_THRESHOLD_PERCENT는 그대로 두고 확인 틱수만 늘려서 더 지속적인 추세만 반영한다.
const CONFIRM_TICKS = 4;

// 최초 조회 전/세션 시작 시 기본값 - 허용(true)이 아니라 중단(false)으로 시작한다
// (2026-08-10, true->false로 변경): 장 시작하자마자 확인된 추세 없이 바로 스캔을 허용해버리면
// 이 필터가 걸러야 할 "아직 방향이 안 잡힌 구간"을 그대로 통과시키는 셈이라 필터의 의미가
// 없다. 대신 매 세션 시작 시 CONFIRM_TICKS만큼 상승 틱이 연속으로 쌓여야(=상승 곡선이
// 실제로 확인돼야) 스캔이 열린다 - 초반 몇 분의 매수 기회를 포기하더라도 방향 없는 구간에서의
// 진입을 막는 쪽을 택함.
let bullish = false;
let lastPrice: number | undefined;
let lastDelta: number | undefined;
let pendingDirection: boolean | undefined;
let pendingCount = 0;
let timer: NodeJS.Timeout | undefined;

async function refresh() {
  try {
    const item = await fetchIndexPrice(KOSPI_ISCD);
    const price = Number(item?.bstp_nmix_prpr);
    if (!Number.isFinite(price)) {
      console.error('[market-condition] invalid bstp_nmix_prpr in response - keeping previous state', item);
      return;
    }

    if (lastPrice === undefined) {
      // 첫 틱은 비교 대상이 없어서 방향 판단을 보류한다.
      lastPrice = price;
      return;
    }

    const delta = ((price - lastPrice) / lastPrice) * 100;
    lastPrice = price;
    lastDelta = delta;

    const tickBullish = delta >= TICK_THRESHOLD_PERCENT;

    if (tickBullish === pendingDirection) {
      pendingCount += 1;
    } else {
      pendingDirection = tickBullish;
      pendingCount = 1;
    }

    console.log(`[market-condition] KOSPI ${price} (틱Δ ${delta.toFixed(3)}%, ${tickBullish ? '매수세' : '약세'} 연속 ${pendingCount}회) 현재상태=${bullish ? '허용' : '중단'}`);

    if (pendingCount >= CONFIRM_TICKS && tickBullish !== bullish) {
      bullish = tickBullish;
      console.log(`[market-condition] 상태 전환 -> ${bullish ? '허용(재개)' : '중단'}`);
      await sendDiscordMessage({
        title: bullish ? '🟢 스캔 재개' : '🟡 스캔 중단',
        description: `코스피 틱간 변화율 ${delta.toFixed(3)}% (연속 ${pendingCount}회) - 신규 스캔 ${bullish ? '재개' : '중단'}`,
        color: bullish ? DISCORD_COLOR.green : DISCORD_COLOR.yellow,
      });
    }
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
  bullish = false;
  lastPrice = undefined;
  lastDelta = undefined;
  pendingDirection = undefined;
  pendingCount = 0;
}

export function isMarketBullish() {
  return bullish;
}

// 매수/매도 시점의 시장 상태를 회고용으로 같이 남기기 위한 값 (Order.kospiDeltaAtBuy /
// PositionWatcher.kospiDeltaAtSell). 아직 첫 틱도 못 돈 상태(재시작 직후 등)면 undefined.
export function getMarketTickDelta() {
  return lastDelta;
}