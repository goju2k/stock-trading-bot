import { Router } from 'express';

import { backfillMinuteBars } from '../../trading/minute-bars';
import { asyncHandler } from '../async-handler';

export const minuteBarsRouter = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 과거 세션들의 매수 종목 분봉 일괄 수집 - body { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', force?: boolean }.
// 세션 수 x 종목 수 x 최대 4회 KIS 호출이라 오래 걸릴 수 있어 바로 202로 응답하고 백그라운드로
// 돌린다. 결과는 서버 로그([minute-bars])와 minute_bars 테이블로 확인한다.
minuteBarsRouter.post('/backfill', asyncHandler(async (req, res) => {
  const { from, to, force } = req.body ?? {};
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    res.status(400).json({ error: 'from/to는 YYYY-MM-DD 형식이어야 합니다' });
    return;
  }

  backfillMinuteBars(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`), { force: force === true })
    .catch((error) => console.error('[minute-bars] backfill failed', error));
  res.status(202).json({ ok: true });
}));