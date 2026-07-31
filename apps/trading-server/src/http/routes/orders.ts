import { Router } from 'express';

import { todayDateOnly } from '../../lib/date';
import { getPrisma } from '../../lib/prisma';
import { asyncHandler } from '../async-handler';

export const ordersRouter = Router();

function parseSessionDate(raw: unknown) {
  if (typeof raw !== 'string') return todayDateOnly();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return todayDateOnly();
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

// ?date=YYYY-MM-DD 없으면 오늘. 기존 OrderStocks/OrderListStore 대체.
ordersRouter.get('/', asyncHandler(async (req, res) => {
  const sessionDate = parseSessionDate(req.query.date);
  const session = await getPrisma().tradingSession.findUnique({ where: { sessionDate } });
  if (!session) {
    res.json([]);
    return;
  }

  const orders = await getPrisma().order.findMany({
    where: { sessionId: session.id },
    orderBy: { orderedAt: 'desc' },
  });
  res.json(orders);
}));