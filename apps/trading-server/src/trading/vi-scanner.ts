import { executeBuy } from './execute-buy';
import { getOrderedCodesToday } from './session-orders';

import { getTradingConfig } from '../config/trading-config';
import { fetchViStatus } from '../kis';
import { ViStatusItem } from '../kis/types';
import { hhmmssDiffSeconds, nowHHMMSS, todayYYYYMMDD } from '../lib/date';
import { getPrisma } from '../lib/prisma';

const SCAN_INTERVAL_MS = 5000; // VI 이벤트는 거래량순위만큼 빈번하지 않아 1초까지는 필요없음
const RECENT_RELEASE_WINDOW_SEC = 180; // VI 해제 후 3분 이내만 모멘텀 신호로 인정

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
    });
  }

  const viActedCodes = Array.from(new Set([ ...acted, ...recentReleases.map((item) => item.mksc_shrn_iscd) ]));
  await prisma.tradingSession.update({ where: { id: sessionId }, data: { viActedCodes } });
}

export function startViScanner(sessionId: number) {
  if (timer) {
    return;
  }

  const loop = async () => {
    try {
      await tick(sessionId);
    } catch (error) {
      console.error('[vi-scanner] tick failed', error);
    }
    timer = setTimeout(loop, SCAN_INTERVAL_MS);
  };

  loop();
  console.log(`[vi-scanner] started for session ${sessionId}`);
}

export function stopViScanner() {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
    console.log('[vi-scanner] stopped');
  }
}

export function isViScannerRunning() {
  return !!timer;
}