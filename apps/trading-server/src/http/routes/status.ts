import { Router } from 'express';

import { getKisEnvConfig } from '../../kis/env';
import { todayDateOnly } from '../../lib/date';
import { getPrisma } from '../../lib/prisma';
import { TradingRuntime, isScannerRunning, isViScannerRunning } from '../../trading';
import { asyncHandler } from '../async-handler';

export const statusRouter = Router();

function safeKisEnv() {
  try {
    return getKisEnvConfig().env;
  } catch {
    // KIS_* env가 아직 설정 안 된 상태 (예: 계좌키 발급 전) - 상태 조회 자체는 막지 않는다.
    return null;
  }
}

statusRouter.get('/', asyncHandler(async (_req, res) => {
  const session = await getPrisma().tradingSession.findUnique({ where: { sessionDate: todayDateOnly() } });

  res.json({
    kisEnv: safeKisEnv(),
    scannerRunning: isScannerRunning(),
    viScannerRunning: isViScannerRunning(),
    activeWatcherCount: TradingRuntime.active().length,
    session: session && {
      date: session.sessionDate,
      isBusinessDay: session.isBusinessDay,
      openedAt: session.openedAt,
      liquidationAt: session.liquidationAt,
      closedAt: session.closedAt,
    },
  });
}));