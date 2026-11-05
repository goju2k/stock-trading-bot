"""매도 규칙 재시뮬레이션 (틱 + 분봉).

sim.js는 position_price_ticks만 써서 실제 매도 이후는 알 수 없었다(censored). 이 버전은 매도 이후를
minute_bars(장 마감까지 정규장 1분봉)로 이어 붙여서, 실제보다 오래 들고 가는 규칙도 끝까지 평가한다.

가격 경로:
  - 틱이 있는 포지션(10/5~): 매수~실제 매도까지는 틱(1초 폴링으로 가격이 바뀔 때마다 기록) 그대로,
    그 이후는 분봉.
  - 틱이 없는 포지션(9월 등): 매수한 분의 다음 분봉부터 분봉만.
  - 분봉 하나는 4개 점으로 펼친다: 양봉이면 시가→저가→고가→종가, 음봉이면 시가→고가→저가→종가
    (분 안의 실제 순서는 모름 - 이 근사가 얼마나 맞는지는 --check로 실제 결과와 비교해서 본다).
  - 15:15(강제청산 시각)에 남아 있으면 그 직전 가격으로 정리.
  - cut_60s는 DB의 priceAt60s로 판단한다(실제 코드와 같은 값).

규칙 파라미터는 서버(trading/experiment.ts)와 같은 이름을 쓴다:
  highPercentage, lowPercentage, cut60sEnabled, quickStopEnabled,
  breakevenAtPct, breakevenLockPct, timeStopMin, timeStopRetPct
우선순위도 서버와 같다: quick_stop → high → low → breakeven → cut_60s → time_stop.

사용:
  python sim_bars.py [CSV폴더 ...]        # 기본: 이 폴더와 data-sep
  python sim_bars.py --check              # 현행 규칙으로 실제 결과를 얼마나 재현하는지
"""
import os
import sys
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
FORCE_HHMM_UTC = (6, 15)  # 15:15 KST


@dataclass
class Pos:
    id: int
    date: str
    code: str
    ordered: pd.Timestamp
    closed: pd.Timestamp | None
    entry: float
    qty: int
    exit: str
    pnl: float
    p60: float | None
    path: list = field(default_factory=list)  # [(Timestamp UTC, price, kind)] kind: 'tick' | 'open' | 'bar'
    has_ticks: bool = False


def load(folder, bars_only=False):
    pos = pd.read_csv(os.path.join(folder, 'positions.csv'), header=None, dtype={2: str},
                      names=['id', 'date', 'code', 'orderedAt', 'closedAt', 'entry', 'qty', 'exit', 'pnl', 'sellPrice', 'p60', 'peak'])
    pos = pos[~pos.code.str.match(r'^Q\d{6}$') & pos.pnl.notna()]
    ticks = pd.read_csv(os.path.join(folder, 'ticks.csv'), header=None, names=['id', 'at', 'price'])
    ticks['at'] = pd.to_datetime(ticks['at'], format='ISO8601')
    bars = pd.read_csv(os.path.join(folder, 'bars.csv'), header=None, dtype={0: str, 1: str, 2: str},
                       names=['code', 'date', 'time', 'open', 'high', 'low', 'close', 'volume'])
    bars['start'] = pd.to_datetime(bars.date + bars.time, format='%Y%m%d%H%M%S') - pd.Timedelta(hours=9)  # UTC
    tick_groups = {k: g for k, g in ticks.groupby('id')}
    bar_groups = {k: g.sort_values('start') for k, g in bars.groupby(['code', 'date'])}

    out = []
    for r in pos.itertuples():
        p = Pos(int(r.id), r.date, r.code, pd.Timestamp(r.orderedAt), pd.Timestamp(r.closedAt) if isinstance(r.closedAt, str) else None,
                float(r.entry), int(r.qty), r.exit if isinstance(r.exit, str) else '', float(r.pnl), None if pd.isna(r.p60) else float(r.p60))
        force_at = p.ordered.normalize() + pd.Timedelta(hours=FORCE_HHMM_UTC[0], minutes=FORCE_HHMM_UTC[1])
        t = tick_groups.get(p.id)
        cursor = p.ordered
        if t is not None and len(t) and p.closed is not None and not bars_only:
            t = t[t['at'] <= p.closed]
            p.path = [(at, float(px), 'tick') for at, px in zip(t['at'], t.price)]
            p.has_ticks = len(p.path) > 0
            cursor = p.closed
        b = bar_groups.get((p.code, p.date.replace('-', '')))
        if b is not None:
            # 커서가 속한 분 다음 분봉부터 (커서 분의 봉은 이미 지난 가격이 섞여 있다)
            nxt = b[(b.start > cursor.floor('min')) & (b.start < force_at)]
            for row in nxt.itertuples():
                pts = (row.open, row.low, row.high, row.close) if row.close >= row.open else (row.open, row.high, row.low, row.close)
                for i, px in enumerate(pts):
                    p.path.append((row.start + pd.Timedelta(seconds=15 * i), float(px), 'open' if i == 0 else 'bar'))
        if p.path:
            out.append(p)
    return out


BASE = dict(highPercentage=3, lowPercentage=4, cut60sEnabled=True, quickStopEnabled=False)

# 분봉 점에서 청산될 때의 체결가 근사. 실제(1초 폴링)는 선을 넘는 순간 팔기 때문에 분봉 저가/종가가
# 아니라 선 근처에서 체결된다.
# - 트레일링 손절: 손절선 대비 -0.14% (9/1~10/30 실제 매도 251건 중앙값)
# - 트레일링 익절: 분봉 고가 대비 -1.0%. 실제 매도가는 "관측된" 고점 대비 -0.35%(중앙값)이지만,
#   분봉 고가는 1초 폴링이 거의 못 보는 진짜 고가라 그보다 더 뺀다. 9월(분봉만)로 맞추고
#   (시뮬 -1,031k / 실제 -1,068k) 10월로 검증했다(분봉만 -373k, 틱+분봉 -454k / 실제 -414k).
# 분봉 시가(open)에서 이미 선 밖이면(갭) 시가로 체결.
HIGH_GIVEBACK_PCT = 1.0
STOP_SLIP_PCT = 0.14


def fill(kind, price, line):
    if kind == 'tick' or kind == 'open':
        return price
    return line


def simulate(p: Pos, rule):
    r = {**BASE, **rule}
    entry = p.entry
    tp = entry * (1 + r['highPercentage'] / 100)
    peak = entry
    first = True
    cut_checked = False
    for t, price, kind in p.path:
        age = (t - p.ordered).total_seconds()
        if r['cut60sEnabled'] and not cut_checked and age >= 60:
            cut_checked = True
            if p.p60 is not None and p.p60 <= entry:
                return p.p60, 'cut_60s'
        if first:
            first = False
            if r['quickStopEnabled'] and price < entry:
                return price, 'quick_stop'
        peak = max(peak, price)
        reached = peak >= tp
        if reached and price < peak:
            return fill(kind, price, max(price, peak * (1 - HIGH_GIVEBACK_PCT / 100))), 'high'
        stop = peak * (1 - r['lowPercentage'] / 100)
        if price <= stop:
            return fill(kind, price, stop * (1 - STOP_SLIP_PCT / 100)), 'low'
        be = r.get('breakevenAtPct')
        be_line = entry * (1 + r.get('breakevenLockPct', 0) / 100)
        if be is not None and peak >= entry * (1 + be / 100) and price <= be_line:
            return fill(kind, price, be_line * (1 - STOP_SLIP_PCT / 100)), 'breakeven'
        ts = r.get('timeStopMin')
        if ts is not None and not reached and age >= ts * 60 and price < entry * (1 + r.get('timeStopRetPct', 0) / 100):
            return price, 'time_stop'
    if r['cut60sEnabled'] and not cut_checked and p.p60 is not None and p.p60 <= entry:
        return p.p60, 'cut_60s'
    return p.path[-1][1], 'eod'


def run(positions, rule):
    rows = []
    for p in positions:
        price, why = simulate(p, rule)
        pnl = (price - p.entry) * p.qty
        rows.append((p.id, p.date, why, pnl, (price / p.entry - 1) * 100))
    return pd.DataFrame(rows, columns=['id', 'date', 'why', 'pnl', 'ret'])


def check(positions, label, rule):
    df = run(positions, rule)
    act = pd.DataFrame([(p.id, p.exit or 'eod', p.pnl, p.has_ticks) for p in positions], columns=['id', 'act', 'act_pnl', 'ticks'])
    m = df.merge(act, on='id')
    for has in [True, False]:
        d = m[m.ticks == has]
        if len(d) == 0:
            continue
        same = (d.why == d.act.replace({'': 'eod'})).mean() * 100
        print(f'[{label}] {"틱+분봉" if has else "분봉만"} {len(d)}건: 시뮬 손익 {d.pnl.sum():>10,.0f} / 실제 {d.act_pnl.sum():>10,.0f}, 청산사유 일치 {same:.0f}%')
        print('   ', pd.crosstab(d.act, d.why).to_dict('index'))


VARIANTS = {
    '현행 (TP3 trail, SL4 trail, cut60s)': {},
    'cut60s 끔': dict(cut60sEnabled=False),
    'SL 2%': dict(lowPercentage=2),
    'SL 3%': dict(lowPercentage=3),
    'SL 6%': dict(lowPercentage=6),
    'SL 8%': dict(lowPercentage=8),
    'TP 1.5%': dict(highPercentage=1.5),
    'TP 2%': dict(highPercentage=2),
    'TP 5%': dict(highPercentage=5),
    'TP 8%': dict(highPercentage=8),
    'BE +1% (lock 0)': dict(breakevenAtPct=1),
    'BE +1.5% (lock 0)': dict(breakevenAtPct=1.5),
    'BE +2% (lock +0.5)': dict(breakevenAtPct=2, breakevenLockPct=0.5),
    'time 10m': dict(timeStopMin=10),
    'time 20m': dict(timeStopMin=20),
    'time 30m': dict(timeStopMin=30),
    'TP 1.5% + BE +1%': dict(highPercentage=1.5, breakevenAtPct=1),
    'TP 5% + BE +2%': dict(highPercentage=5, breakevenAtPct=2),
    'SL 6% + time 20m': dict(lowPercentage=6, timeStopMin=20),
}


def compare(sets):
    base = {k: run(v, {}) for k, v in sets.items()}
    rows = []
    for name, rule in VARIANTS.items():
        row = {'variant': name}
        for k, positions in sets.items():
            df = run(positions, rule)
            b = base[k]
            days = df.groupby('date').pnl.sum() - b.groupby('date').pnl.sum()
            dates = sorted(df.date.unique())
            half = dates[len(dates) // 2]
            row[f'{k} 손익'] = round(df.pnl.sum())
            row[f'{k} 건당%'] = round(df.ret.mean(), 2)
            row[f'{k} 차이 전반'] = round(df[df.date < half].pnl.sum() - b[b.date < half].pnl.sum())
            row[f'{k} 차이 후반'] = round(df[df.date >= half].pnl.sum() - b[b.date >= half].pnl.sum())
            row[f'{k} 개선일'] = f'{int((days > 0).sum())}/{int((days != 0).sum())}'
        rows.append(row)
    return pd.DataFrame(rows).set_index('variant')


if __name__ == '__main__':
    pd.set_option('display.width', 250)
    pd.set_option('display.max_columns', 30)
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    folders = args or [HERE, os.path.join(HERE, 'data-sep')]
    sets = {}
    for f in folders:
        label = '10월' if f == HERE else os.path.basename(f).replace('data-', '')
        sets[label] = load(f)
    if '--check' in sys.argv:
        for k, v in sets.items():
            # 9월은 cut_60s 도입(10/5) 전이라 실제 규칙도 그것 없이 재현해야 비교가 된다
            check(v, k, {} if k == '10월' else {'cut60sEnabled': False})
    else:
        print(compare(sets).to_string())