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

  // 15:15 평일 - 정규장 마감(15:30) 15분 전 잔여 포지션 강제청산 시작. 기존 15:25(마감 5분 전)는
  // 100건 넘는 포지션을 청산하기엔(동시호가 구간 15:20-15:30까지 겹침) 너무 촉박했다
  // (2026-08-04 확인) - 여유를 더 두기 위해 10분 앞당김.
  cron.schedule('15 15 * * 1-5', runSafely('liquidateTodaySession', liquidateTodaySession), { timezone: TIMEZONE });

  // 15:30 평일 - 정규장 마감과 동시에 세션 종료 기록. 기존 16:00(마감 30분 후)에서 앞당김 -
  // 마감 후 굳이 30분을 더 기다릴 이유가 없다.
  cron.schedule('30 15 * * 1-5', runSafely('closeTodaySession', closeTodaySession), { timezone: TIMEZONE });

  console.log('[cron] trading schedule registered (09:00 start / 15:15 liquidate / 15:30 close, Asia/Seoul)');
}