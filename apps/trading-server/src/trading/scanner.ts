import { executeBuy } from './execute-buy';
import { isForeignInstitutionNetBuy } from './foreign-institution-cache';
import { getOrderedCodesToday } from './session-orders';
import { isTargetRow } from './target-filter';

import { getTradingConfig } from '../config/trading-config';
import { fetchVolumeRank } from '../kis';
import { nowHHMMSS } from '../lib/date';
import { getPrisma } from '../lib/prisma';

let timer: NodeJS.Timeout | undefined;

// 기존 services/trading/src/hooks/kis-catch-stock-hook.tsx(useKisCatchStock) 포팅.
// refreshRateMs 간격으로 거래증가율 순위를 조회해서, 오늘 아직 안 산/안 지나친 종목 중
// 조건(isTargetRow + 외국인/기관 순매수)에 맞는 첫 종목 1개만 매수한다. 조회된 종목은 전부
// 오늘자 pass 처리해서 "처음 리스트업 되는 매물만 잡는다"는 기존 동작을 그대로 유지한다.
// market-condition.ts(isMarketBullish) 게이트는 2026-08-13 제거 - vi_release를 끄고
// scanner.ts 위주로 전환하면서, 아직 신뢰도가 안 검증된 틱 기반 필터(같은 날 코스피 되돌림을
// 못 거른 사고 있었음)에 매수 여부를 계속 얹어두지 않기로 함. market-condition 캐시 자체는
// 계속 돌아서 kospiDeltaAtBuy 등 회고용 데이터는 그대로 쌓인다.
async function tick(sessionId: number) {
  const config = await getTradingConfig();
  const prisma = getPrisma();

  if (!config.autoTradingEnabled) {
    return config;
  }

  // 매수 시작 시각(entryStartHhmm, 기본 09:10) 전엔 KIS 조회도 passedCodes 누적도 하지 않는다 -
  // 즉 스캔 자체가 이 시각부터 시작한다. 그래서 09:00~09:10 사이 먼저 순위에 올라왔던 종목도
  // 09:10 이후 조건을 만족하면 "처음 출현"으로 보고 살 수 있다. 9/1~10/2 분석에서 09:00~09:10
  // 매수 42건이 승률 33%/-346,785원으로 전반·후반 모두 나빴던 게 근거(2026-10-05).
  if (nowHHMMSS() < `${String(config.entryStartHhmm).padStart(4, '0')}00`) {
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
      // 회고용 - 이 틱에 순위 리스트에서 몇 번째였는지, 리스트가 몇 개였는지, KIS 원본 행 전체.
      scanSnapshot: { rank: items.indexOf(target) + 1, candidateCount: items.length, row: { ...target } },
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