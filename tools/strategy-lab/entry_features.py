"""진입 분석: 매수 시점 특징(scanSnapshot 순위표 행 + 매수 전 분봉)과 결과(60초 시점 매수가 이하 여부, 최종 손익) 비교.

입력은 export.sh가 뽑은 CSV. 과적합 방지를 위해 모든 특징을 기간 전반/후반으로 나눠 같이 본다.
사용: python entry_features.py [CSV 폴더]  (기본: 이 스크립트 폴더)
"""
import json
import os
import re

import numpy as np
import pandas as pd

import sys

DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
pd.set_option('display.width', 200)
pd.set_option('display.max_columns', 30)

pos = pd.read_csv(os.path.join(DIR, 'positions.csv'), header=None, names=[
    'id', 'date', 'code', 'orderedAt', 'closedAt', 'entry', 'qty', 'exit', 'pnl', 'sellPrice', 'p60', 'peak'], dtype={'code': str})
ent = pd.read_csv(os.path.join(DIR, 'entries.csv'), header=None, names=['id', 'scanPrice', 'kospiDelta', 'headline', 'firstTick'])
snaps = {}
with open(os.path.join(DIR, 'snapshots.jsonl'), encoding='utf-8') as f:
    for line in f:
        o = json.loads(line)
        snaps[o['id']] = o['snap']
bars = pd.read_csv(os.path.join(DIR, 'bars.csv'), header=None, names=['code', 'date', 'time', 'open', 'high', 'low', 'close', 'volume'],
                   dtype={'code': str, 'date': str, 'time': str})

df = pos.merge(ent, on='id', how='left')
df = df[~df.code.str.match(r'^Q\d{6}$')]  # ETN은 이제 안 사므로 제외(손익도 기록 안 돼 있음)
df['orderedAt'] = pd.to_datetime(df.orderedAt, format='ISO8601') + pd.Timedelta(hours=9)  # KST
df['closedAt'] = pd.to_datetime(df.closedAt, format='ISO8601') + pd.Timedelta(hours=9)
df = df[df.pnl.notna()].copy()
df['ret'] = df.pnl / (df.entry * df.qty) * 100
# 60초 시점 매수가 이하(cut_60s 조건). 60초 전에 끝난 건은 매도가로 판단.
df['bad60'] = np.where(df.p60.notna(), df.p60 <= df.entry, df.sellPrice <= df.entry)
df['hhmm'] = df.orderedAt.dt.hour * 100 + df.orderedAt.dt.minute
df['slip'] = (df.entry / df.scanPrice - 1) * 100
df['firstRet'] = (df.firstTick / df.entry - 1) * 100

ETF_RE = re.compile(r'^(KODEX|TIGER|RISE|SOL|ACE|PLUS|KIWOOM|HANARO|KoAct|1Q|UNICORN|DS |TIME|TRUSTON|WON|BNK|HK|마이다스|에셋플러스|파워|흥국|더제이)')


def snap_feats(row):
    s = snaps.get(row.id)
    if not s:
        return pd.Series(dtype=float)
    r = s['row']
    f = lambda k: float(r[k]) if r.get(k) not in (None, '') else np.nan
    return pd.Series({
        'rank': s['rank'], 'cands': s['candidateCount'],
        'upPct': f('prdy_ctrt'), 'volInc': f('vol_inrt'), 'turnover': f('vol_tnrt'),
        'volVsPrev': f('acml_vol') / f('prdy_vol') if f('prdy_vol') else np.nan,
        'trAmtEok': f('acml_tr_pbmn') / 1e8, 'price': f('stck_prpr'),
        'mcapEok': f('stck_prpr') * f('lstn_stcn') / 1e8,
        'isEtf': bool(ETF_RE.match(r.get('hts_kor_isnm', ''))),
    })


df = pd.concat([df, df.apply(snap_feats, axis=1)], axis=1)
# scanSnapshot이 없는 기간(10/5 이전)은 가격만 Order.buyPrice(스캔 시점 가격)로 대신한다.
df['price'] = df['price'].fillna(df.scanPrice) if 'price' in df else df.scanPrice
df['isEtf'] = df['isEtf'].fillna(False) if 'isEtf' in df else False

# 매수 전 분봉 특징 - 매수한 분(minute)의 봉은 매수 이후 체결이 섞이므로 그 직전 분까지만 쓴다.
bars['hm'] = bars.time.str[:4].astype(int)
bar_groups = {k: g for k, g in bars.groupby(['code', 'date'])}


def bar_feats(row):
    g = bar_groups.get((row.code, row.date.replace('-', '')))
    if g is None:
        return pd.Series(dtype=float)
    before = g[g.hm < row.hhmm]
    if len(before) < 3:
        return pd.Series(dtype=float)
    hi = before.high.max()
    t = row.orderedAt
    def close_at(minutes_ago):
        m = (t - pd.Timedelta(minutes=minutes_ago))
        hm = m.hour * 100 + m.minute
        b = before[before.hm <= hm]
        return b.close.iloc[-1] if len(b) else np.nan
    last5 = before.tail(5).volume.mean()
    avg = before.volume.mean()
    return pd.Series({
        'vsDayHigh': (row.entry / hi - 1) * 100,  # 매수가가 그때까지 장중 고가 대비 어디인지
        'fromOpen': (row.entry / g.open.iloc[0] - 1) * 100,
        'ret5m': (row.entry / close_at(5) - 1) * 100,
        'ret15m': (row.entry / close_at(15) - 1) * 100,
        'volBurst': last5 / avg if avg else np.nan,  # 직전 5분 평균 거래량 / 장 시작 이후 평균
        'prevBarUp': (before.close.iloc[-1] - before.open.iloc[-1]) / before.open.iloc[-1] * 100,
    })


df = pd.concat([df, df.apply(bar_feats, axis=1)], axis=1)

days = sorted(df.date.unique())
half = days[len(days) // 2]
df['half'] = np.where(df.date < half, 'H1', 'H2')
print(f'건수 {len(df)} (ETN 제외), 기간 {days[0]}~{days[-1]}, 전반 <{half} {sum(df.half == "H1")}건 / 후반 {sum(df.half == "H2")}건')
print(f'전체: 60초 매수가 이하 {df.bad60.mean() * 100:.0f}%, 손익 {df.pnl.sum():,.0f}원, 건당 평균 {df.ret.mean():.2f}%\n')

FEATS = ['hhmm', 'rank', 'upPct', 'volInc', 'volVsPrev', 'turnover', 'trAmtEok', 'price', 'mcapEok', 'slip', 'kospiDelta',
         'vsDayHigh', 'fromOpen', 'ret5m', 'ret15m', 'volBurst', 'prevBarUp']


def summarize(feat, q=3):
    if feat not in df:
        return None
    d = df[df[feat].notna()].copy()
    if d[feat].nunique() < q:
        return None
    d['bin'] = pd.qcut(d[feat], q, duplicates='drop')
    out = d.groupby('bin', observed=True).agg(n=('id', 'size'), bad60=('bad60', 'mean'), ret=('ret', 'mean'), pnl=('pnl', 'sum'))
    for h in ['H1', 'H2']:
        sub = d[d.half == h].groupby('bin', observed=True)
        out[f'bad60_{h}'] = sub.bad60.mean()
        out[f'ret_{h}'] = sub.ret.mean()
    out['bad60'] = (out.bad60 * 100).round(0)
    out['bad60_H1'] = (out.bad60_H1 * 100).round(0)
    out['bad60_H2'] = (out.bad60_H2 * 100).round(0)
    for c in ['ret', 'ret_H1', 'ret_H2']:
        out[c] = out[c].round(2)
    out['pnl'] = out.pnl.round(0).astype(int)
    return out


if __name__ == '__main__':
    for feat in FEATS:
        out = summarize(feat)
        if out is not None:
            print(f'== {feat}')
            print(out.to_string())
            print()
    for feat in ['isEtf', 'headline']:
        g = df.groupby(feat).agg(n=('id', 'size'), bad60=('bad60', 'mean'), ret=('ret', 'mean'), pnl=('pnl', 'sum'))
        g['bad60'] = (g.bad60 * 100).round(0)
        print(f'== {feat}\n{g.round(2).to_string()}\n')
    df.to_pickle(os.path.join(DIR, 'entry_features.pkl'))