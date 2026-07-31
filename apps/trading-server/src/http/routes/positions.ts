import { Router } from 'express';

import { todayDateOnly } from '../../lib/date';
import { getPrisma } from '../../lib/prisma';
import { TradingRuntime } from '../../trading';
import { asyncHandler } from '../async-handler';

export const positionsRouter = Router();

// 오늘 세션의 매수/매도 상태머신 전체 (진행중 + 오늘 완료된 것 포함) - 기존 LogCenter 대체.
positionsRouter.get('/', asyncHandler(async (_req, res) => {
  const session = await getPrisma().tradingSession.findUnique({ where: { sessionDate: todayDateOnly() } });
  if (!session) {
    res.json([]);
    return;
  }

  const watchers = await getPrisma().positionWatcher.findMany({
    where: { order: { sessionId: session.id } },
    include: { order: true },
    orderBy: { updatedAt: 'desc' },
  });

  res.json(watchers.map((watcher) => ({
    code: watcher.code,
    name: watcher.order.name,
    state: watcher.state,
    buyPrice: watcher.order.buyPrice,
    qty: watcher.order.qty,
    sellAmtHigh: watcher.sellAmtHigh,
    sellAmtLow: watcher.sellAmtLow,
    highOrLow: watcher.highOrLow,
    stateMessage: watcher.stateMessage,
    updatedAt: watcher.updatedAt,
  })));
}));

// 기존 LogCenter의 "강제매도" 버튼 대체. 현재 프로세스가 살아서 추적중인 watcher만 대상 -
// (서버 막 재시작돼서 아직 resume 안 된 경우 등에는 404. 잠시 후 재시도하면 됨)
positionsRouter.post('/:code/force-sell', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const watcher = TradingRuntime.active().find((w) => w.code === code);

  if (!watcher) {
    res.status(404).json({ error: `no active watcher tracked for ${code}` });
    return;
  }

  await watcher.forceSell('관리자 강제매도 (API)');
  res.json({ ok: true });
}));