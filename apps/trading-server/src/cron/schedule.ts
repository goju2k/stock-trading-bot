import * as cron from 'node-cron';

import { closeTodaySession, liquidateTodaySession, openTodaySession } from './session';

const TIMEZONE = 'Asia/Seoul';

function runSafely(name: string, task: () => Promise<unknown>) {
  return async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[cron] ${name} failed`, error);
    }
  };
}

export function startTradingCron() {
  // 09:00 평일 - 세션 시작 (개장일 체크 포함)
  cron.schedule('0 9 * * 1-5', runSafely('openTodaySession', openTodaySession), { timezone: TIMEZONE });

  // 15:25 평일 - 정규장 마감(15:30) 직전 잔여 포지션 강제청산
  cron.schedule('25 15 * * 1-5', runSafely('liquidateTodaySession', liquidateTodaySession), { timezone: TIMEZONE });

  // 16:00 평일 - 세션 종료 기록
  cron.schedule('0 16 * * 1-5', runSafely('closeTodaySession', closeTodaySession), { timezone: TIMEZONE });

  console.log('[cron] trading schedule registered (09:00 start / 15:25 liquidate / 16:00 close, Asia/Seoul)');
}