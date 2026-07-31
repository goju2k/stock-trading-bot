import { fetchBusinessDay } from '../kis';
import { getKisEnvConfig } from '../kis/env';
import { getPrisma } from '../lib/prisma';

function todayDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function todayYYYYMMDD() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}${mm}${dd}`;
}

// 09:00 평일 트리거. 개장일이면 세션을 열고, TODO(Phase 2): TradingScanner + BalancePoller 시작.
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

  await prisma.tradeEvent.create({
    data: {
      sessionId: session.id,
      type: 'session_start',
      message: isBusinessDay ? '세션 시작 (개장일)' : '휴장일 - 세션 시작하지 않음',
    },
  });

  console.log(`[cron] session opened for ${sessionDate.toISOString().slice(0, 10)} (businessDay=${isBusinessDay}, env=${env})`);
  return session;
}

// 15:25 평일 트리거 (정규장 마감 15:30 직전). 신규 스캔 중단 + 잔여 포지션 강제청산.
// TODO(Phase 2): position_watchers 중 state != done/error 인 항목을 조회해서 전량 시장가 매도 주문.
export async function liquidateTodaySession() {
  const sessionDate = todayDateOnly();
  const prisma = getPrisma();
  const session = await prisma.tradingSession.findUnique({ where: { sessionDate } });

  if (!session || !session.openedAt) {
    console.log('[cron] liquidation skipped - no open session today');
    return;
  }

  await prisma.tradingSession.update({
    where: { id: session.id },
    data: { liquidationAt: new Date() },
  });

  await prisma.tradeEvent.create({
    data: {
      sessionId: session.id,
      type: 'forced_liquidation',
      message: '15:25 장마감 강제청산 트리거 (Phase 2에서 실제 매도 주문 연결 예정)',
    },
  });

  console.log('[cron] liquidation triggered - TODO: sell remaining open positions (Phase 2)');
}

// 16:00 평일 트리거. 세션 공식 종료 기록.
// TODO(Phase 2): 스캐너 루프 정지. 아직 청산 확인 안 된 watcher가 있으면 BalancePoller는 계속 둠.
export async function closeTodaySession() {
  const sessionDate = todayDateOnly();
  const prisma = getPrisma();
  const session = await prisma.tradingSession.findUnique({ where: { sessionDate } });

  if (!session) {
    console.log('[cron] close skipped - no session record today');
    return;
  }

  await prisma.tradingSession.update({
    where: { id: session.id },
    data: { closedAt: new Date() },
  });

  await prisma.tradeEvent.create({
    data: {
      sessionId: session.id,
      type: 'session_end',
      message: '세션 종료',
    },
  });

  console.log('[cron] session closed');
}