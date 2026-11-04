import { fetchDailyMinuteBars } from '../kis';
import { MinuteBarItem } from '../kis/types';
import { getPrisma } from '../lib/prisma';

// 장 마감 후 그날 매수했던 종목의 정규장 분봉을 받아 minute_bars에 저장한다(2026-11-04).
// position_price_ticks는 매도 순간 기록이 멈춰서 "손절을 더 넓혔으면", "cut_60s로 판 종목이
// 나중에 올랐나"를 평가할 수 없었다 - 매수 시점부터 장 마감까지의 분봉이 있으면 매도 이후
// 구간까지 규칙을 다시 돌려볼 수 있다.
//
// 페이지네이션 주의(CLAUDE.md, 2026-10 분봉 재조회 시 겪은 문제 - 09:00 근처에서 커서가 오후로
// 점프): 당일분봉조회(inquire-time-itemchartprice) 대신 일별분봉조회(inquire-time-dailychartprice)
// 를 쓰고 날짜를 명시한다. 이 API는 120개를 채우려고 전일 봉까지 섞어서 돌려주므로(실측
// 2026-11-04) 요청 날짜/정규장 시간대 행만 남기고, 아래 중 하나라도 해당하면 멈춘다.
//  - 응답에 전일 이전 날짜가 섞여 나옴(그날 09:00까지 다 받았다는 뜻)
//  - 가장 이른 봉이 09:00
//  - 다음 커서가 이전 커서보다 앞으로 가지 않음(커서가 오후로 튀는 경우 포함)
//  - MAX_PAGES 도달
const MARKET_OPEN = '090000';
const MARKET_CLOSE = '153000';
// 정규장 390분 / 120봉 = 4페이지면 충분하다. 거래 없는 분은 봉이 없어서 보통 그보다 적다.
const MAX_PAGES = 8;
// 공용 real 큐 간격(60ms)만으로는 연속 조회시 EGW00201이 자주 나서(2026-11-04 백필 실측, 재시도로는
// 전부 회복) 수집기 자체적으로 페이지 사이를 더 띄운다. 15:40 하루치(20종목 내외)는 20초 정도 걸린다.
const PAGE_GAP_MS = 250;

type FetchPage = (hour: string) => Promise<MinuteBarItem[]>;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function minusOneMinute(hhmmss: string) {
  const total = Number(hhmmss.slice(0, 2)) * 60 + Number(hhmmss.slice(2, 4)) - 1;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}${String(total % 60).padStart(2, '0')}00`;
}

// 하루치 정규장 분봉을 시간 오름차순으로 반환. fetchPage를 주입받는 순수 로직이라 테스트 가능.
export async function fetchFullDayMinuteBars(date: string, fetchPage: FetchPage) {
  const bars = new Map<string, MinuteBarItem>();
  let cursor = MARKET_CLOSE;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await fetchPage(cursor);
    const sameDay = rows.filter((row) => row.stck_bsop_date === date
      && row.stck_cntg_hour >= MARKET_OPEN && row.stck_cntg_hour <= MARKET_CLOSE);
    sameDay.forEach((row) => bars.set(row.stck_cntg_hour, row));

    if (sameDay.length === 0 || rows.some((row) => row.stck_bsop_date < date)) break;

    const earliest = sameDay.reduce((min, row) => (row.stck_cntg_hour < min ? row.stck_cntg_hour : min), MARKET_CLOSE);
    if (earliest <= MARKET_OPEN) break;

    const next = minusOneMinute(earliest);
    if (next >= cursor) break;
    cursor = next;
  }

  return [ ...bars.values() ].sort((a, b) => a.stck_cntg_hour.localeCompare(b.stck_cntg_hour));
}

// KIS의 KST 날짜/시각 문자열을 UTC Date로.
function kstToDate(date: string, time: string) {
  return new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}+09:00`);
}

function toYYYYMMDD(sessionDate: Date) {
  return sessionDate.toISOString().slice(0, 10).replace(/-/g, '');
}

async function collectCodeMinuteBars(code: string, date: string, force?: boolean): Promise<number | 'skipped' | 'failed'> {
  const prisma = getPrisma();
  if (!force && await prisma.minuteBar.count({ where: { code, date } }) > 0) {
    return 'skipped';
  }

  try {
    const bars = await fetchFullDayMinuteBars(date, async (hour) => {
      await sleep(PAGE_GAP_MS);
      return fetchDailyMinuteBars(code, date, hour);
    });
    const result = await prisma.minuteBar.createMany({
      data: bars.map((bar) => ({
        code,
        date,
        time: bar.stck_cntg_hour,
        barAt: kstToDate(date, bar.stck_cntg_hour),
        open: Number(bar.stck_oprc),
        high: Number(bar.stck_hgpr),
        low: Number(bar.stck_lwpr),
        close: Number(bar.stck_prpr),
        volume: Number(bar.cntg_vol),
      })),
      skipDuplicates: true,
    });
    return result.count;
  } catch (error) {
    console.error(`[minute-bars] ${date} ${code} 분봉 수집 실패`, error);
    return 'failed';
  }
}

// 세션 하나(그날 매수한 모든 종목)의 분봉을 저장. 이미 그날 분봉이 있는 종목은 건너뛴다
// (force면 다시 받아서 없는 봉만 추가 - unique(code,date,time) + skipDuplicates).
// 종목별 실패는 로그만 남기고 다음 종목으로 넘어간다 - 회고용 수집이 매매나 다른 종목을 막으면 안 된다.
export async function collectSessionMinuteBars(sessionDate: Date, options?: { force?: boolean; }) {
  const prisma = getPrisma();
  const date = toYYYYMMDD(sessionDate);
  const orders = await prisma.order.findMany({
    where: { session: { sessionDate } },
    select: { code: true },
    distinct: [ 'code' ],
  });

  let saved = 0;
  let skipped = 0;
  const failed: string[] = [];

  // KIS 레이트리밋 큐를 한꺼번에 채우지 않도록 종목은 하나씩 순서대로 처리한다.
  for (let i = 0; i < orders.length; i += 1) {
    const { code } = orders[i];
    // eslint-disable-next-line no-await-in-loop
    const result = await collectCodeMinuteBars(code, date, options?.force);
    if (result === 'skipped') skipped += 1;
    else if (result === 'failed') failed.push(code);
    else saved += result;
  }

  console.log(`[minute-bars] ${date} 종목 ${orders.length}개 - 저장 ${saved}봉, 기존 보유로 건너뜀 ${skipped}종목, 실패 ${failed.length}종목${failed.length ? ` (${failed.join(',')})` : ''}`);
  return { date, codes: orders.length, saved, skipped, failed };
}

// 15:40 크론 - 오늘 세션이 열렸던 개장일에만 수집한다.
export async function collectTodayMinuteBars(sessionDate: Date) {
  const session = await getPrisma().tradingSession.findUnique({ where: { sessionDate } });
  if (!session?.openedAt) return undefined;
  return collectSessionMinuteBars(sessionDate);
}

// 과거 세션 일괄 수집(관리용 API). KIS 일별분봉은 최대 1년치를 보관한다.
export async function backfillMinuteBars(from: Date, to: Date, options?: { force?: boolean; }) {
  const sessions = await getPrisma().tradingSession.findMany({
    where: { sessionDate: { gte: from, lte: to }, openedAt: { not: null } },
    orderBy: { sessionDate: 'asc' },
  });
  const results = [];
  for (let i = 0; i < sessions.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await collectSessionMinuteBars(sessions[i].sessionDate, options));
  }
  return results;
}