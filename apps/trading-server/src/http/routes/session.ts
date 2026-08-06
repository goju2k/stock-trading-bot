import { Router } from 'express';

import { closeTodaySession, liquidateTodaySession } from '../../cron/session';
import { asyncHandler } from '../async-handler';

export const sessionRouter = Router();

// 서버가 15:15/15:30 크론 트리거 시각을 못 넘긴 채(다운 등) 지나가버린 경우를 위한 수동 대체
// 경로 - 2026-08-06, 부팅 실패로 서버가 몇 시간 다운돼 있다가 장마감 후 늦게 복구되면서 오늘
// 세션이 청산/마감 없이 스캐너가 계속 도는 상태로 남았던 사고에서 확인. 정상 크론과 동일한
// 함수를 그대로 호출하므로 동작은 15:15+15:30이 같이 일어난 것과 동일 - 스캐너를 못 멈추면
// 다음날 openTodaySession()이 module-level timer 가드(`if (timer) return`)에 막혀 새 세션의
// 스캐너를 아예 못 띄우게 된다.
sessionRouter.post('/close-today', asyncHandler(async (_req, res) => {
  await liquidateTodaySession();
  await closeTodaySession();
  res.json({ ok: true });
}));