import { executeBuy } from './execute-buy';
import { isForeignInstitutionNetBuy } from './foreign-institution-cache';
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

  const items = await fetchVolumeRank({
    minPrice: config.minTargetAmt,
    maxPrice: config.maxOrderAmt,
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

export function startScanner(sessionId: number) {
  if (timer) {
    return;
  }

  const loop = async () => {
    let refreshRateMs = 1000;
    try {
      const config = await tick(sessionId);
      refreshRateMs = config.refreshRateMs;
    } catch (error) {
      console.error('[scanner] tick failed', error);
    }
    timer = setTimeout(loop, refreshRateMs);
  };

  loop();
  console.log(`[scanner] started for session ${sessionId}`);
}

export function stopScanner() {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
    console.log('[scanner] stopped');
  }
}

export function isScannerRunning() {
  return !!timer;
}