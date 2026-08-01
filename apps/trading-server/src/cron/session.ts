import { getTradingConfig } from '../config/trading-config';
import { fetchBusinessDay } from '../kis';
import { getKisEnvConfig } from '../kis/env';
import { todayDateOnly, todayYYYYMMDD } from '../lib/date';
import { getPrisma } from '../lib/prisma';
import {
  TradingRuntime,
  isScannerRunning,
  logTradeEvent,
  resumeOpenWatchers,
  startForeignInstitutionCache,
  startGapScanner,
  startScanner,
  startViScanner,
  stopForeignInstitutionCache,
  stopGapScanner,
  stopScanner,
  stopViScanner,
} from '../trading';

function startAllScanners(sessionId: number) {
  startForeignInstitutionCache();
  startScanner(sessionId);
  startViScanner(sessionId);
  startGapScanner(sessionId);
}

function stopAllScanners() {
  stopScanner();
  stopViScanner();
  stopGapScanner();
  stopForeignInstitutionCache();
}

// 09:00 평일 트리거. 개장일이고 자동매매가 켜져 있으면 세션을 열고 스캐너들을 시작한다.
export async function openTodaySession() {
  const sessionDate = todayDateOnly();
  const businessDay = await fetchBusinessDay(todayYYYYMMDD());
  const isBusinessDay = businessDay?.opnd_yn === 'Y';
  const { env } = getKisEnvConfig();
  const prisma = getPrisma();

  const session = await prisma.tradingSession.upsert({
    where: { sessionDate },
    create: {
      sessionDate,
      isBusinessDay,
      kisEnv: env,
      openedAt: isBusinessDay ? new Date() : null,
    },
    update: {
      isBusinessDay,
      kisEnv: env,
      openedAt: isBusinessDay ? new Date() : undefined,
    },
  });

  await logTradeEvent({
    sessionId: session.id,
    type: 'session_start',
    message: isBusinessDay ? `세션 시작 (개장일, ${env})` : '휴장일 - 세션 시작하지 않음',
  });

  if (isBusinessDay) {
    const config = await getTradingConfig();
    if (config.autoTradingEnabled) {
      startAllScanners(session.id);
    } else {
      console.log('[cron] autoTradingEnabled=false - scanners not started');
    }
  }

  console.log(`[cron] session opened for ${sessionDate.toISOString().slice(0, 10)} (businessDay=${isBusinessDay}, env=${env})`);
  return session;
}

// 15:25 평일 트리거 (정규장 마감 15:30 직전). 신규 스캔 중단 + 잔여 포지션 전량 강제청산.
export async function liquidateTodaySession() {
  const sessionDate = todayDateOnly();
  const prisma = getPrisma();
  const session = await prisma.tradingSession.findUnique({ where: { sessionDate } });

  if (!session || !session.openedAt) {
    console.log('[cron] liquidation skipped - no open session today');
    return;
  }

  stopAllScanners();

  await prisma.tradingSession.update({
    where: { id: session.id },
    data: { liquidationAt: new Date() },
  });

  const activeWatchers = TradingRuntime.active();

  await logTradeEvent({
    sessionId: session.id,
    type: 'forced_liquidation',
    message: `15:25 장마감 강제청산 트리거 (대상 ${activeWatchers.length}건)`,
  });

  console.log(`[cron] liquidating ${activeWatchers.length} open position(s)`);

  await Promise.all(activeWatchers.map(async (watcher) => {
    try {
      await watcher.forceSell('15:25 장마감 강제청산');
    } catch (error) {
      console.error(`[cron] forceSell failed for ${watcher.code}`, error);
    }
  }));
}

// 오늘 세션의 매수/매도/실현손익 요약 ("마감내역") - session_end 알림 본문에 쓴다.
async function buildSessionSummary(sessionId: number) {
  const prisma = getPrisma();
  const orders = await prisma.order.findMany({
    where: { sessionId },
    include: { positionWatcher: true },
  });

  const totalBuys = orders.length;
  const doneCount = orders.filter((o) => o.positionWatcher?.state === 'done').length;
  const openCount = orders.filter((o) => o.positionWatcher && ![ 'done', 'error' ].includes(o.positionWatcher.state)).length;

  const sellEvents = await prisma.tradeEvent.findMany({ where: { sessionId, type: { in: [ 'sell_executed', 'forced_liquidation' ] }, code: { not: null } } });

  let realizedPnl = 0;
  sellEvents.forEach((event) => {
    const order = orders.find((o) => o.code === event.code);
    const payload = event.payload as { price?: number; qty?: number; } | null;
    if (order && payload?.price) {
      realizedPnl += (payload.price - Number(order.buyPrice)) * (payload.qty ?? order.qty);
    }
  });

  return `매수 ${totalBuys}건 / 매도완료 ${doneCount}건 (미완료 ${openCount}건) / 실현손익 약 ${realizedPnl.toLocaleString('ko-KR')}원`;
}

// 16:00 평일 트리거. 세션 공식 종료 기록 + 마감내역 요약. (BalancePoller/미종료 watcher는 계속 둔다)
export async function closeTodaySession() {
  const sessionDate = todayDateOnly();
  const prisma = getPrisma();
  const session = await prisma.tradingSession.findUnique({ where: { sessionDate } });

  if (!session) {
    console.log('[cron] close skipped - no session record today');
    return;
  }

  stopAllScanners();

  await prisma.tradingSession.update({
    where: { id: session.id },
    data: { closedAt: new Date() },
  });

  const summary = await buildSessionSummary(session.id);

  await logTradeEvent({
    sessionId: session.id,
    type: 'session_end',
    message: `세션 종료 - ${summary}`,
  });

  console.log(`[cron] session closed (${summary})`);
}

// 서버 부팅 시 1회 호출. 오늘 세션이 열려있는데(closedAt 없음) 프로세스가 재시작된 경우
// (배포/크래시) 미종료 watcher와 스캐너 루프를 복구한다. 평범한 재기동(장 시작 전/마감 후)에는
// 오늘자 열린 세션이 없으니 아무 일도 하지 않는다.
export async function resumeTodaySessionIfNeeded() {
  const sessionDate = todayDateOnly();
  const prisma = getPrisma();
  const session = await prisma.tradingSession.findUnique({ where: { sessionDate } });

  if (!session || !session.openedAt || session.closedAt) {
    return;
  }

  await resumeOpenWatchers(session.id);

  const config = await getTradingConfig();
  if (config.autoTradingEnabled && !isScannerRunning() && !session.liquidationAt) {
    startAllScanners(session.id);
    console.log(`[cron] scanners resumed for session ${session.id} after restart`);
  }
}