import { getPrisma } from '../lib/prisma';

// 오늘 어느 전략이든 이미 매수한 종목코드 (volume 스캐너와 VI 스캐너가 같은 종목을
// 중복으로 사들이지 않도록 공유하는 조회).
export async function getOrderedCodesToday(sessionId: number) {
  const rows = await getPrisma().order.findMany({ where: { sessionId }, select: { code: true } });
  return new Set(rows.map((row) => row.code));
}