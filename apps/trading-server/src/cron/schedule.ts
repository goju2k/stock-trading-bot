import * as cron from 'node-cron';

import { closeTodaySession, ensureTodaySessionOpen, liquidateTodaySession, openTodaySession, stopNewEntries } from './session';

import { DISCORD_COLOR, sendDiscordMessage } from '../notify/discord';

const TIMEZONE = 'Asia/Seoul';

// 2026-08-19 사고: openTodaySession()이 09:00에 실패(KIS chk-holiday 오류)했는데 이 래퍼가
// 로그만 남기고 조용히 넘어가서 아무도 모르는 채로 그날 세션이 통째로 안 열렸다 - 재시작해도
// resumeTodaySessionIfNeeded()는 "이미 열린 세션 복구"만 하지 "아직 한번도 안 열린 세션을
// 새로 여는" 로직이 아니라서 도움이 안 됐다. 이제 실패하면 디스코드로도 알린다 - 세 크론
// 태스크 모두 매매 자체를 좌우하는 중요한 트리거라 어떤 것도 조용히 묻히면 안 된다.
function runSafely(name: string, task: () => Promise<unknown>) {
  return async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[cron] ${name} failed`, error);
      await sendDiscordMessage({
        title: '🔴 크론 실패',
        description: `[${name}] 실행 중 오류가 발생했습니다.\n${(error as Error).message}`,
        color: DISCORD_COLOR.red,
      });
    }
  };
}

export function startTradingCron() {
  // 09:00 평일 - 세션 시작 (개장일 체크 포함)
  cron.schedule('0 9 * * 1-5', runSafely('openTodaySession', openTodaySession), { timezone: TIMEZONE });

  // 09:05~14:55 평일 5분 간격 - 09:00 정시 오픈이 실패했거나(위 사고) 그 시각에 프로세스가
  // 아예 안 떠 있었던 경우(배포/크래시 타이밍) 보완용 재시도. ensureTodaySessionOpen()은
  // 먼저 DB만 가볍게 확인해서 이미 열려있으면 아무 KIS 호출 없이 바로 리턴하므로, 정상적인
  // 날엔 매 5분 도는 것 자체는 거의 공짜다. 15:10 이후엔 남은 장이 너무 짧아 의미가 없어서
  // 이 시각 이후로는 시도하지 않는다(함수 내부에서 자체 컷오프).
  // 분 필드를 5-55/5로 시작 - */5는 0도 포함해서 위 09:00 정시 오픈 크론과 정확히 같은 순간에
  // 같이 발화한다(2026-08-19 이 크론을 추가할 때부터 있던 버그, 2026-08-21 발견). 09:00 크론의
  // openTodaySession()이 KIS 호출(fetchBusinessDay/liquidateStalePositions, 레이트리밋으로
  // 몇 초 소요)을 끝내기 전에 이 크론의 "이미 열렸나" DB 체크가 끼어들면 세션이 아직 없는
  // 걸로 보고 openTodaySession()을 한 번 더 부른다 - upsert라 세션 자체는 안전하지만
  // liquidateStalePositions()가 09:00의 가장 혼잡한 순간에 중복 호출된다(2026-08-21 실측:
  // session_start 로그가 7초 간격으로 두 번 찍힘). 5-55/5로 0을 빼서 완전히 겹치지 않게 한다.
  cron.schedule('5-55/5 9-14 * * 1-5', runSafely('ensureTodaySessionOpen', ensureTodaySessionOpen), { timezone: TIMEZONE });

  // 14:30 평일 - 신규 매수(진입 스캐너)만 종료. 15:15 강제청산까지 시간이 얼마 안 남은 채로
  // 매수하면 트레일링 익절/손절이 제대로 작동해볼 겨를도 없이 그냥 강제청산으로 끝나는 경우가
  // 잦다는 관찰(2026-08-21)에 따라 15:15보다 45분 앞서 진입만 먼저 끊는다. 보유 포지션 관리와
  // market-condition 회고용 데이터 수집은 계속된다(session.ts stopNewEntries() 참고).
  cron.schedule('30 14 * * 1-5', runSafely('stopNewEntries', stopNewEntries), { timezone: TIMEZONE });

  // 15:15 평일 - 정규장 마감(15:30) 15분 전 잔여 포지션 강제청산 시작. 기존 15:25(마감 5분 전)는
  // 100건 넘는 포지션을 청산하기엔(동시호가 구간 15:20-15:30까지 겹침) 너무 촉박했다
  // (2026-08-04 확인) - 여유를 더 두기 위해 10분 앞당김.
  cron.schedule('15 15 * * 1-5', runSafely('liquidateTodaySession', liquidateTodaySession), { timezone: TIMEZONE });

  // 15:30 평일 - 정규장 마감과 동시에 세션 종료 기록. 기존 16:00(마감 30분 후)에서 앞당김 -
  // 마감 후 굳이 30분을 더 기다릴 이유가 없다.
  cron.schedule('30 15 * * 1-5', runSafely('closeTodaySession', closeTodaySession), { timezone: TIMEZONE });

  console.log('[cron] trading schedule registered (09:00 start / 09:05~14:55 open catch-up / 14:30 new-entry cutoff / 15:15 liquidate / 15:30 close, Asia/Seoul)');
}