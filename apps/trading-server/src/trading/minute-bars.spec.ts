import { fetchFullDayMinuteBars } from './minute-bars';

import { MinuteBarItem } from '../kis/types';

function bar(date: string, time: string): MinuteBarItem {
  return { stck_bsop_date: date, stck_cntg_hour: time, stck_prpr: '100', stck_oprc: '100', stck_hgpr: '100', stck_lwpr: '100', cntg_vol: '1', acml_tr_pbmn: '0' };
}

// 하루 전체(전일 15:30까지 포함)를 최신순으로 들고 있다가, 커서 이하 시각부터 120개씩 잘라 주는 가짜 KIS.
function fakeKis(allDesc: MinuteBarItem[], pageSize = 120) {
  const calls: string[] = [];
  const fetchPage = async (hour: string) => {
    calls.push(hour);
    const start = allDesc.findIndex((row) => row.stck_bsop_date === '20261030' && row.stck_cntg_hour <= hour);
    return start < 0 ? [] : allDesc.slice(start, start + pageSize);
  };
  return { calls, fetchPage };
}

function minutes(date: string, from: string, to: string) {
  const out: MinuteBarItem[] = [];
  let m = Number(from.slice(0, 2)) * 60 + Number(from.slice(2, 4));
  const end = Number(to.slice(0, 2)) * 60 + Number(to.slice(2, 4));
  for (; m <= end; m += 1) {
    out.push(bar(date, `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`));
  }
  return out;
}

describe('fetchFullDayMinuteBars', () => {
  it('정규장 전체를 페이지로 이어받고 전일 봉/장외 봉은 버린다', async () => {
    const today = [ ...minutes('20261030', '090000', '151900'), bar('20261030', '153000') ].reverse();
    const yesterday = [ bar('20261029', '195800'), ...minutes('20261029', '090000', '153000').reverse() ];
    const { calls, fetchPage } = fakeKis([ ...today, ...yesterday ]);

    const bars = await fetchFullDayMinuteBars('20261030', fetchPage);

    expect(bars).toHaveLength(381);
    expect(bars[0].stck_cntg_hour).toBe('090000');
    expect(bars[bars.length - 1].stck_cntg_hour).toBe('153000');
    expect(bars.every((row) => row.stck_bsop_date === '20261030')).toBe(true);
    expect(calls.length).toBeLessThanOrEqual(4);
  });

  it('커서가 뒤로 가지 않는 응답(오후로 튀는 경우)이면 멈춘다', async () => {
    const calls: string[] = [];
    const bars = await fetchFullDayMinuteBars('20261030', async (hour) => {
      calls.push(hour);
      // 몇 번째 호출이든 늘 오후 봉만 돌려주는 비정상 응답
      return minutes('20261030', '140000', '151900').reverse();
    });

    expect(calls).toEqual([ '153000', '135900' ]);
    expect(bars).toHaveLength(80);
  });

  it('거래가 없던 종목(빈 응답)은 빈 배열', async () => {
    expect(await fetchFullDayMinuteBars('20261030', async () => [])).toEqual([]);
  });
});