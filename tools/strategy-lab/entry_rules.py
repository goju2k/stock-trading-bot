"""entry_features.py 결과에서 후보 필터를 골라 일자별 일관성과 겹침을 본다. 먼저 entry_features.py를 돌릴 것."""
import os
import numpy as np
import pandas as pd

import sys

DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
df = pd.read_pickle(os.path.join(DIR, 'entry_features.pkl'))

# 제외(skip) 후보 - 전반/후반 모두 나빴던 쪽
RULES = {
    'volInc<=383 (거래증가율 하위2/3)': df.volInc <= 383,
    'rank>=14': df['rank'] >= 14,
    'trAmt>20억': df.trAmtEok > 20,
    'price<4555': df.price < 4555,
    'vsDayHigh>-0.55 (장중고가 근처)': df.vsDayHigh > -0.55,
}

print(df[['volInc', 'rank', 'trAmtEok', 'price', 'vsDayHigh', 'mcapEok']].corr(method='spearman').round(2), '\n')

def report(name, skip):
    keep, out = df[~skip], df[skip]
    by = df.assign(skip=skip).groupby(['date', 'skip']).ret.mean().unstack()
    both = by.dropna()
    wins = (both[False] > both[True]).sum()
    h = {}
    for half in ['H1', 'H2']:
        d = df[df.half == half]; s = skip[df.half == half]
        h[half] = (d[s].pnl.sum(), d[~s].ret.mean() - d[s].ret.mean())
    print(f'{name:34s} 제외 {skip.sum():3d}건 손익 {out.pnl.sum():>9,.0f}원 (60초이하 {out.bad60.mean()*100:.0f}% vs 남김 {keep.bad60.mean()*100:.0f}%) | '
          f'일자별 남김>제외 {wins}/{len(both)}일 | 제외분 손익 H1 {h["H1"][0]:>8,.0f} H2 {h["H2"][0]:>8,.0f} | 건당차 H1 {h["H1"][1]:+.2f}%p H2 {h["H2"][1]:+.2f}%p')

for name, skip in RULES.items():
    report(name, skip.fillna(False))

print()
combo = (RULES['volInc<=383 (거래증가율 하위2/3)'] & RULES['trAmt>20억']).fillna(False)
report('volInc<=383 AND trAmt>20억', combo)
combo2 = (RULES['volInc<=383 (거래증가율 하위2/3)'] | RULES['trAmt>20억']).fillna(False)
report('volInc<=383 OR trAmt>20억', combo2)
print('\n거래증가율 x 거래대금 교차표 (건수 / 60초이하% / 건당평균%)')
d = df.assign(vi=pd.qcut(df.volInc, 3, labels=['vi_lo', 'vi_mid', 'vi_hi']), ta=pd.qcut(df.trAmtEok, 3, labels=['ta_lo', 'ta_mid', 'ta_hi']))
print(d.pivot_table(index='vi', columns='ta', values='ret', aggfunc=['size', lambda x: round(x.mean(), 2)], observed=False))
print(d.pivot_table(index='vi', columns='ta', values='bad60', aggfunc=lambda x: round(x.mean() * 100), observed=False))
