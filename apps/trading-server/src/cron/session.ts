import { getTradingConfig } from '../config/trading-config';
import { fetchBusinessDay, inquireBalance, placeMarketOrder } from '../kis';
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

// 09:00 세션 오픈 직전, 계좌에 아직 남아있는 잔여 포지션(전일 이전 세션에서 정상적으로
// 정리되지 못한 건 - done 오탐/누락으로 실제로는 계속 보유 중이던 경우 등)을 전부 시장가로
// 정리한다. 이 계좌는 프로그램매매 전용이라 잔고에 남아있는 건 전부 봇이 산 것으로 간주해도
// 안전하다 - DB 매칭 여부와 무관하게 잔고 전체를 대상으로 한다(계좌를 겸용으로 쓰게 되면 이
// 가정부터 재검토할 것). 대응하는 DB 건이 이미 done으로 잘못 기록돼 있어도(예: 2026-08-04
// inquire-balance 페이지네이션 누락 버그로 오탐 done 처리된 건들) 여기서 실제 잔고 기준으로
// 전부 덮어써서 현행화한다 - 정리 결과는 원래 Order의 sessionId로 기록해서, 이미 발송된 그날
// 리포트는 못 고쳐도 이후 월간 집계 등에서 정확한 데이터를 보게 한다.
// 반환값은 오늘의 startingCash로 쓸 가용현금 - 방금 넣은 매도주문은 아직 체결 반영 전이라
// inquireBalance()가 돌려주는 가용현금에 포함 안 되므로, 전량 체결된다는 전제로 각 정리 대상의
// 평가금액(현재가*수량)을 더해서 추정한다.
async function liquidateStalePositions(): Promise<number | undefined> {
  const prisma = getPrisma();

  try {
    const { holdings, summary } = await inquireBalance();
    const availableCash = Number(summary?.prvs_rcdl_excc_amt) || 0;
    const liveHoldings = holdings.filter((h) => Number(h.hldg_qty) > 0);
    const liveCodes = new Set(liveHoldings.map((h) => h.pdno));

    let estimatedProceeds = 0;
    let liquidatedCount = 0;

    // 1) 잔고에 실제로 남아있는 건 전부 매도. 개별 종목마다 디스코드 알림을 보내면 정리 대상이
    //    많은 날(예: 2026-08-04, 134건) 채널이 도배되므로 notify:false로 DB에만 기록하고,
    //    끝나고 요약 메시지 하나로 묶어 보낸다.
    await Promise.all(liveHoldings.map(async (holding) => {
      const price = Number(holding.prpr);
      estimatedProceeds += price * Number(holding.hldg_qty);

      let res;
      try {
        res = await placeMarketOrder({ buy: false, code: holding.pdno, qty: holding.hldg_qty });
      } catch (error) {
        console.error(`[cron] stale liquidation sell failed for ${holding.pdno}`, error);
        return;
      }
      if (res.rt_cd !== '0') {
        console.error(`[cron] stale liquidation sell rejected for ${holding.pdno}: ${res.msg1}`);
        return;
      }

      // 상태 필터 없이 최신 건 하나를 찾는다 - 이미 done/error로(잘못) 기록돼 있어도 이번
      // 정리 결과로 덮어써야 하므로 notIn 필터를 걸지 않는다.
      const watcher = await prisma.positionWatcher.findFirst({
        where: { code: holding.pdno },
        include: { order: true },
        orderBy: { id: 'desc' },
      });

      const pnl = Math.round((price - Number(holding.pchs_avg_pric)) * Number(holding.hldg_qty));

      if (watcher) {
        await prisma.positionWatcher.update({
          where: { id: watcher.id },
          data: { state: 'done', stateMessage: '(정리) 익일 잔여 포지션 정리', sellPrice: price, sellQty: Number(holding.hldg_qty), pnl, closedAt: new Date() },
        });
      }

      liquidatedCount += 1;
      await logTradeEvent({
        sessionId: watcher?.order.sessionId ?? null,
        type: 'forced_liquidation',
        code: holding.pdno,
        name: watcher?.order.name ?? holding.prdt_name,
        message: '익일 잔여 포지션 정리',
        payload: { qty: holding.hldg_qty, price, pnl },
        notify: false,
      });
    }));

    // 2) DB엔 미종료로 남아있는데 실제 잔고엔 없는(이미 다른 경로로 사라진) 건 - 매도 없이
    //    done으로 현행화만 한다.
    const staleWatchers = await prisma.positionWatcher.findMany({ where: { state: { notIn: [ 'done', 'error' ] } } });
    const reconciledCodes = staleWatchers.filter((w) => !liveCodes.has(w.code));
    await Promise.all(reconciledCodes.map((w) => prisma.positionWatcher.update({
      where: { id: w.id },
      data: { state: 'done', stateMessage: '(정리) 실보유 없음 확인', closedAt: new Date() },
    })));

    if (liquidatedCount > 0 || reconciledCodes.length > 0) {
      const reconciledNote = reconciledCodes.length > 0 ? ` (실보유 없음 확인 ${reconciledCodes.length}건 별도)` : '';
      await logTradeEvent({
        sessionId: null,
        type: 'forced_liquidation',
        message: `전일 잔여 포지션 정리 ${liquidatedCount}건 완료${reconciledNote}`,
      });
    }

    return availableCash + estimatedProceeds;
  } catch (error) {
    console.error('[cron] liquidateStalePositions failed - startingCash will be null today', error);
    return undefined;
  }
}

// 09:00 평일 트리거. 개장일이고 자동매매가 켜져 있으면 세션을 열고 스캐너들을 시작한다.
export async function openTodaySession() {
  const sessionDate = todayDateOnly();
  const businessDay = await fetchBusinessDay(todayYYYYMMDD());
  const isBusinessDay = businessDay?.opnd_yn === 'Y';
  const { env } = getKisEnvConfig();
  const prisma = getPrisma();
  const startingCash = isBusinessDay ? await liquidateStalePositions() : undefined;

  const session = await prisma.tradingSession.upsert({
    where: { sessionDate },
    create: {
      sessionDate,
      isBusinessDay,
      kisEnv: env,
      openedAt: isBusinessDay ? new Date() : null,
      startingCash,
    },
    update: {
      isBusinessDay,
      kisEnv: env,
      openedAt: isBusinessDay ? new Date() : undefined,
      startingCash,
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

// 15:15 평일 트리거 (정규장 마감 15:30 15분 전). 신규 스캔 중단 + 잔여 포지션 전량 강제청산.
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
    message: `15:15 장마감 강제청산 트리거 (대상 ${activeWatchers.length}건)`,
  });

  console.log(`[cron] liquidating ${activeWatchers.length} open position(s)`);

  await Promise.all(activeWatchers.map(async (watcher) => {
    try {
      await watcher.forceSell('15:15 장마감 강제청산');
    } catch (error) {
      console.error(`[cron] forceSell failed for ${watcher.code}`, error);
    }
  }));
}

interface StrategyStat {
  buys: number;
  wins: number;
  losses: number;
  winReturnPctSum: number;
  lossReturnPctSum: number;
}

// 오늘 세션의 매수/매도/실현손익 + 가용률 + 전략별 승률/손익비 요약 ("마감내역, 데일리 리포트") -
// session_end 알림 본문에 쓴다. 2026-08-05 이전엔 TradeEvent.payload(JSON)를 종목코드로 다시
// 매칭해서 손익을 복원했는데, forceSell()이 payload에 price/pnl을 안 남기는 경로가 있어서
// 강제청산 손익이 리포트에서 통째로 빠지는 버그가 있었다 - 이제 PositionWatcher.pnl(매도가
// 확정되는 모든 경로에서 직접 채워짐)을 그대로 읽는다.
async function buildSessionSummary(sessionId: number) {
  const prisma = getPrisma();
  const session = await prisma.tradingSession.findUnique({ where: { id: sessionId } });
  const orders = await prisma.order.findMany({
    where: { sessionId },
    include: { positionWatcher: true },
  });

  const totalBuys = orders.length;
  const doneCount = orders.filter((o) => o.positionWatcher?.state === 'done').length;
  const openCount = orders.filter((o) => o.positionWatcher && ![ 'done', 'error' ].includes(o.positionWatcher.state)).length;

  let realizedPnl = 0;
  const bySrc = new Map<string, StrategyStat>();
  orders.forEach((o) => {
    bySrc.set(o.sourceStrategy, { buys: (bySrc.get(o.sourceStrategy)?.buys ?? 0) + 1, wins: 0, losses: 0, winReturnPctSum: 0, lossReturnPctSum: 0 });
  });

  orders.forEach((o) => {
    const pnl = o.positionWatcher?.pnl;
    if (pnl === null || pnl === undefined) return;

    realizedPnl += pnl;

    const investedAmt = Number(o.buyPrice) * o.qty;
    const returnPct = investedAmt > 0 ? (pnl / investedAmt) * 100 : 0;
    const stat = bySrc.get(o.sourceStrategy);
    if (!stat) return;
    if (pnl > 0) {
      stat.wins += 1;
      stat.winReturnPctSum += returnPct;
    } else {
      stat.losses += 1;
      stat.lossReturnPctSum += returnPct;
    }
  });

  const investedTotal = orders.reduce((sum, o) => sum + Number(o.buyPrice) * o.qty, 0);
  const utilizationLine = session?.startingCash
    ? `\n가용률: 투입 ${investedTotal.toLocaleString('ko-KR')}원 / 가용 ${session.startingCash.toLocaleString('ko-KR')}원 (${((investedTotal / session.startingCash) * 100).toFixed(1)}%)`
    : '';

  const strategyLines = Array.from(bySrc.entries())
    .filter(([ , stat ]) => stat.buys > 0)
    .map(([ src, stat ]) => {
      const closed = stat.wins + stat.losses;
      if (closed === 0) return `${src}: 매수 ${stat.buys}건, 청산 0건`;
      const winRate = ((stat.wins / closed) * 100).toFixed(1);
      const avgWin = stat.wins > 0 ? (stat.winReturnPctSum / stat.wins).toFixed(2) : '-';
      const avgLoss = stat.losses > 0 ? (stat.lossReturnPctSum / stat.losses).toFixed(2) : '-';
      return `${src}: 매수 ${stat.buys}건, 청산 ${closed}건(승 ${stat.wins}/패 ${stat.losses}, 승률 ${winRate}%) 평균익절 +${avgWin}% 평균손절 ${avgLoss}%`;
    })
    .join('\n');

  return `매수 ${totalBuys}건 / 매도완료 ${doneCount}건 (미완료 ${openCount}건) / 실현손익 약 ${realizedPnl.toLocaleString('ko-KR')}원`
    + utilizationLine
    + (strategyLines ? `\n${strategyLines}` : '');
}

// 15:30 평일 트리거 (정규장 마감과 동시). 세션 공식 종료 기록 + 마감내역 요약. (BalancePoller/미종료 watcher는 계속 둔다)
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