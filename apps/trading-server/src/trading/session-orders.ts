import { getPrisma } from '../lib/prisma';

// 오늘 어느 전략이든 이미 매수한 종목코드 (volume 스캐너와 VI 스캐너가 같은 종목을
// 중복으로 사들이지 않도록 공유하는 조회).
export async function getOrderedCodesToday(sessionId: number) {
  const rows = await getPrisma().order.findMany({ where: { sessionId }, select: { code: true } });
  return new Set(rows.map((row) => row.code));
}

// 오늘 세션의 누적 실현손익 - 매도 체결 디스코드 메시지에 "오늘 누적 손익"을 붙이기 위한
// 조회(2026-08-27, 보는 재미를 위한 요청). PositionWatcher.pnl은 매도가 확정되는 모든
// 경로(watchForSell/forceSell/liquidateStalePositions)에서 채워지므로 그대로 합산한다.
export async function getRealizedPnlToday(sessionId: number) {
  const result = await getPrisma().positionWatcher.aggregate({
    where: { order: { sessionId }, pnl: { not: null } },
    _sum: { pnl: true },
  });
  return result._sum.pnl ?? 0;
}