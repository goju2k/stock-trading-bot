import { executeBuy } from './execute-buy';
import { isMarketBullish } from './market-condition';
import { getOrderedCodesToday } from './session-orders';

import { getTradingConfig } from '../config/trading-config';
import { fetchFluctuationRank } from '../kis';
import { FluctuationItem } from '../kis/types';
import { getPrisma } from '../lib/prisma';

const TICK_INTERVAL_MS = 5000; // 갭은 장 초반 짧은 창에서만 도니까 1초까지 필요없음

let timer: NodeJS.Timeout | undefined;
let stopped = false;

// 등락률순위 응답의 prdy_ctrt(전일종가 대비 현재가 %)와 oprc_vrss_prpr_rate(시가 대비 현재가 %)를
// 조합해서 시가를 역산한다: 현재가 = 전일종가*(1+prdyCtrt/100) = 시가*(1+oprcVrss/100)
// -> 시가/전일종가 = (1+prdyCtrt/100) / (1+oprcVrss/100) -> 갭% = (그 비율 - 1) * 100
function estimateGapPercent(item: FluctuationItem): number | null {
  const prdyCtrt = Number(item.prdy_ctrt);
  const oprcVrss = Number(item.oprc_vrss_prpr_rate);
  if (!Number.isFinite(prdyCtrt) || !Number.isFinite(oprcVrss) || oprcVrss <= -100) {
    return null;
  }
  const ratio = (1 + prdyCtrt / 100) / (1 + oprcVrss / 100);
  return (ratio - 1) * 100;
}

// 시가 갭 상승 전략. 세션 시작(openedAt) 이후 gapScanWindowMinutes 동안만 동작하고
// 창이 지나면 스스로 멈춘다 - "장 시작 직후 갭"에만 반응하는 게 목적이라 하루 종일 돌 이유가 없다.
// true를 반환하면 계속 틱, false면 스스로 정지.
async function tick(sessionId: number): Promise<boolean> {
  const config = await getTradingConfig();
  if (!config.autoTradingEnabled || !config.gapStrategyEnabled) {
    return true;
  }

  const prisma = getPrisma();
  const session = await prisma.tradingSession.findUnique({ where: { id: sessionId } });
  if (!session || !session.openedAt) {
    return true;
  }

  const elapsedMinutes = (Date.now() - session.openedAt.getTime()) / 60000;
  if (elapsedMinutes > config.gapScanWindowMinutes) {
    console.log(`[gap-scanner] scan window (${config.gapScanWindowMinutes}min) elapsed - stopping`);
    return false;
  }

  // 코스피가 하락중이면 이번 틱은 건너뛴다 (market-condition.ts 참고) - 스캔 창 자체를
  // 끝내는 건 아니라서 나중에 시장이 반등하면 남은 창 시간 안에서 다시 스캔한다.
  if (!isMarketBullish()) {
    return true;
  }

  const items = await fetchFluctuationRank({
    minPrice: config.minTargetAmt,
    maxPrice: config.maxCandidatePrice,
    minVolume: config.minTradingCount,
  });

  const passed = new Set(session.gapPassedCodes);
  const orderedToday = await getOrderedCodesToday(sessionId);

  const target = items
    .filter((item) => !orderedToday.has(item.stck_shrn_iscd) && !passed.has(item.stck_shrn_iscd))
    .map((item) => ({ item, gap: estimateGapPercent(item) }))
    .find(({ gap }) => gap !== null && gap >= config.gapUpThresholdPercent);

  if (target) {
    await executeBuy({
      sessionId,
      config,
      code: target.item.stck_shrn_iscd,
      name: target.item.hts_kor_isnm,
      price: Number(target.item.stck_prpr),
      sourceStrategy: 'gap_up',
    });
  }

  // scanner.ts(거래대금순위)와 동일하게, 매수 성공 여부와 무관하게 이번 틱에 조회된 종목은
  // 전부 훑고 지나간 걸로 기록한다 - 매수 스킵(최소금액 미달/매매불가 등)된 종목을 스캔 창이
  // 끝날 때까지 5초마다 계속 재시도하지 않기 위함.
  const gapPassedCodes = Array.from(new Set([ ...passed, ...items.map((item) => item.stck_shrn_iscd) ]));
  await prisma.tradingSession.update({ where: { id: sessionId }, data: { gapPassedCodes } });

  return true;
}

export function startGapScanner(sessionId: number) {
  if (timer) {
    return;
  }
  stopped = false;

  const loop = async () => {
    let shouldContinue = true;
    try {
      shouldContinue = await tick(sessionId);
    } catch (error) {
      console.error('[gap-scanner] tick failed', error);
    }

    if (shouldContinue && !stopped) {
      timer = setTimeout(loop, TICK_INTERVAL_MS);
    } else {
      timer = undefined;
    }
  };

  loop();
  console.log(`[gap-scanner] started for session ${sessionId}`);
}

export function stopGapScanner() {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
}

export function isGapScannerRunning() {
  return !!timer;
}