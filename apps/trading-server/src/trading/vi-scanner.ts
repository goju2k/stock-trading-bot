import { executeBuy } from './execute-buy';
import { isMarketBullish } from './market-condition';
import { getOrderedCodesToday } from './session-orders';

import { getTradingConfig } from '../config/trading-config';
import { fetchViStatus } from '../kis';
import { ViStatusItem } from '../kis/types';
import { hhmmssDiffSeconds, nowHHMMSS, todayYYYYMMDD } from '../lib/date';
import { getPrisma } from '../lib/prisma';

// 5000 -> 3000 (2026-08-05): 모든 요청이 kis/request-queue.ts의 공유 큐(초당 1건, 모의투자
// 기준)를 거치므로 이 값 자체가 실제 체크 주기를 보장하진 않는다 - 그래도 틱을 더 자주 걸어야
// 그만큼 빨리 큐에 들어가서 조금이라도 먼저 처리될 기회가 생긴다.
const SCAN_INTERVAL_MS = 3000;
// 180 -> 90 (2026-08-05, 전략 실험): 해제 후 너무 늦게 반응한 뒤늦은 진입을 더 타이트하게 거른다.
const RECENT_RELEASE_WINDOW_SEC = 90;

let timer: NodeJS.Timeout | undefined;

function isRecentRelease(item: ViStatusItem) {
  if (!item.vi_cncl_hour) return false; // 공란 = 아직 발동중(미해제)
  return hhmmssDiffSeconds(item.vi_cncl_hour, nowHHMMSS()) <= RECENT_RELEASE_WINDOW_SEC;
}

// VI(변동성완화장치) 해제 모멘텀 전략. 거래대금순위 스캐너와는 독립적으로 돌면서, 방금 VI가
// 해제된 종목을 잡는다. 매수 체결/청산 처리(PositionWatcher)는 기존 전략과 완전히 동일하게 공유.
async function tick(sessionId: number) {
  const config = await getTradingConfig();
  if (!config.autoTradingEnabled || !config.viStrategyEnabled) {
    return;
  }

  // 코스피가 하락중이면 신규 스캔을 멈춘다 (market-condition.ts 참고).
  if (!isMarketBullish()) {
    return;
  }

  const prisma = getPrisma();
  const items = await fetchViStatus(todayYYYYMMDD());
  const session = await prisma.tradingSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return;
  }

  const acted = new Set(session.viActedCodes);
  const orderedToday = await getOrderedCodesToday(sessionId);

  // 아직 발동중인 종목은 acted에 넣지 않는다 - 나중에 해제되면 그때 잡아야 하므로.
  const recentReleases = items.filter(isRecentRelease);
  const target = recentReleases.find(
    (item) => !acted.has(item.mksc_shrn_iscd) && !orderedToday.has(item.mksc_shrn_iscd),
  );

  if (target) {
    // vi_prc(VI발동가격)를 현재가 근사치로 사용 - 시장가 주문이라 수량 산정용 참고값일 뿐이고,
    // 실제 체결가는 매수 시점의 실시간 시세를 따른다.
    await executeBuy({
      sessionId,
      config,
      code: target.mksc_shrn_iscd,
      name: target.hts_kor_isnm,
      price: Number(target.vi_prc),
      sourceStrategy: 'vi_release',
      viKindCode: target.vi_kind_code,
      viDprt: target.vi_dprt,
    });
  }

  const viActedCodes = Array.from(new Set([ ...acted, ...recentReleases.map((item) => item.mksc_shrn_iscd) ]));
  await prisma.tradingSession.update({ where: { id: sessionId }, data: { viActedCodes } });
}

let stopped = false;

export function startViScanner(sessionId: number) {
  if (timer) {
    return;
  }
  stopped = false;

  const loop = async () => {
    try {
      await tick(sessionId);
    } catch (error) {
      console.error('[vi-scanner] tick failed', error);
    }
    // stopViScanner()가 이 tick()이 진행되는 동안 호출됐으면 여기서 다시 스케줄을 걸면 안 된다
    // (2026-08-06: 이 체크가 없어서 stopViScanner() 호출 직후에도 스캐너가 계속 돌던 버그 -
    // gap-scanner.ts는 애초에 이 패턴으로 돼 있었음).
    if (!stopped) {
      timer = setTimeout(loop, SCAN_INTERVAL_MS);
    }
  };

  loop();
  console.log(`[vi-scanner] started for session ${sessionId}`);
}

export function stopViScanner() {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
    console.log('[vi-scanner] stopped');
  }
}

export function isViScannerRunning() {
  return !!timer;
}