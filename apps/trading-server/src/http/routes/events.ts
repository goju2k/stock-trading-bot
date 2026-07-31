import { Router } from 'express';

import { getPrisma } from '../../lib/prisma';
import { asyncHandler } from '../async-handler';

export const eventsRouter = Router();

// 매수/매도/에러/세션 시작·종료 로그. 기존 LogCenter의 로그 스트림 + 향후 FCM 푸시 트리거 소스.
eventsRouter.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const events = await getPrisma().tradeEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(events);
}));