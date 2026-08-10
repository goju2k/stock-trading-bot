import { executeBuy } from './execute-buy';
import { isForeignInstitutionNetBuy } from './foreign-institution-cache';
import { isMarketBullish } from './market-condition';
import { getOrderedCodesToday } from './session-orders';
import { isTargetRow } from './target-filter';

import { getTradingConfig } from '../config/trading-config';
import { fetchVolumeRank } from '../kis';
import { getPrisma } from '../lib/prisma';

let timer: NodeJS.Timeout | undefined;

// 기존 services/trading/src/hooks/kis-catch-stock-hook.tsx(useKisCatchStock) 포팅.
// refreshRateMs 간격으로 거래대금순위를 조회해서, 오늘 아직 안 산/안 지나친 종목 중
// 조건(isTargetRow + 외국인/기관 순매수)에 맞는 첫 종목 1개만 매수한다. 조회된 종목은 전부
// 오늘자 pass 처리해서 "처음 리스트업 되는 매물만 잡는다"는 기존 동작을 그대로 유지한다.
async function tick(sessionId: number) {
  const config = await getTradingConfig();
  const prisma = getPrisma();

  if (!config.autoTradingEnabled) {
    return config;
  }

  // 코스피가 하락중이면 신규 스캔을 멈춘다 - market-condition.ts 참고 (롱온리 모멘텀 전략이라
  // 하락장에서 개별 종목 강세도 같이 끌려갈 확률이 높다, 2026-08-06 확인). config로 끌 수
  // 있다 - 기본 off (marketRegimeFilterEnabled 참고).
  if (config.marketRegimeFilterEnabled && !isMarketBullish()) {
    return config;
  }

  const items = await fetchVolumeRank({
    minPrice: config.minTargetAmt,
    maxPrice: config.maxCandidatePrice,
    minVolume: config.minTradingCount,
  });

  const session = await prisma.tradingSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return config;
  }

  const passed = new Set(session.passedCodes);
  const orderedToday = await getOrderedCodesToday(sessionId);

  const target = items.find((item) => {
    const code = item.mksc_shrn_iscd;
    if (orderedToday.has(code) || passed.has(code) || !isTargetRow(item, config)) {
      return false;
    }
    if (config.requireForeignInstitutionNetBuy && !isForeignInstitutionNetBuy(code)) {
      return false;
    }
    return true;
  });

  if (target) {
    await executeBuy({
      sessionId,
      config,
      code: target.mksc_shrn_iscd,
      name: target.hts_kor_isnm,
      price: Number(target.stck_prpr),
      sourceStrategy: 'volume_rank',
    });
  }

  const passedCodes = Array.from(new Set([ ...passed, ...items.map((item) => item.mksc_shrn_iscd) ]));
  await prisma.tradingSession.update({ where: { id: sessionId }, data: { passedCodes } });

  return config;
}

let stopped = false;

export function startScanner(sessionId: number) {
  if (timer) {
    return;
  }
  stopped = false;

  const loop = async () => {
    let refreshRateMs = 1000;
    try {
      const config = await tick(sessionId);
      refreshRateMs = config.refreshRateMs;
    } catch (error) {
      console.error('[scanner] tick failed', error);
    }
    // stopScanner()가 이 tick()이 진행되는 동안 호출됐으면(레이트리밋 지연 등으로 tick 자체가
    // 오래 걸릴 때 특히) 여기서 다시 스케줄을 걸면 안 된다 - stopped 플래그로 확인
    // (2026-08-06: 이 체크가 없어서 stopScanner() 호출 직후에도 스캐너가 계속 돌던 버그).
    if (!stopped) {
      timer = setTimeout(loop, refreshRateMs);
    }
  };

  loop();
  console.log(`[scanner] started for session ${sessionId}`);
}

export function stopScanner() {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
    console.log('[scanner] stopped');
  }
}

export function isScannerRunning() {
  return !!timer;
}