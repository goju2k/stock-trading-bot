// 60초 시점에 매수가 위였던(=60초 체크를 통과해 계속 보유한) 거래의 가격 경로 분석
const { usable } = require('./sim');

const surv = usable.filter((p) => p.p60 !== null && p.p60 > p.entry);
const pct = (x, e) => (100 * (x - e)) / e;
const rows = surv.map((p) => {
  const prices = p.ticks.map((t) => t.price);
  const mfe = pct(Math.max(p.entry, ...prices), p.entry);
  const mae = pct(Math.min(p.entry, ...prices), p.entry);
  const ret = pct(p.sellPrice, p.entry);
  const holdMin = (p.closedAt - p.orderedAt) / 60000;
  return { ...p, mfe, mae, ret, holdMin };
});

console.log(`survivors: ${rows.length}, pnl ${rows.reduce((a, r) => a + r.pnl, 0)}`);
console.log('\n[exit reason]');
const by = {};
for (const r of rows) {
  const k = r.exit || '(none)';
  by[k] ??= { n: 0, pnl: 0, mfe: 0, ret: 0, hold: 0 };
  Object.assign(by[k], { n: by[k].n + 1, pnl: by[k].pnl + r.pnl, mfe: by[k].mfe + r.mfe, ret: by[k].ret + r.ret, hold: by[k].hold + r.holdMin });
}
for (const [k, v] of Object.entries(by)) console.log(`${k.padEnd(8)} n=${v.n} pnl=${v.pnl} avgMFE=${(v.mfe / v.n).toFixed(2)}% avgRet=${(v.ret / v.n).toFixed(2)}% avgHold=${(v.hold / v.n).toFixed(1)}m`);

console.log('\n[MFE 구간별: 최고 몇 %까지 갔다가 결국 어떻게 끝났나]');
const buckets = [ [ 0, 1 ], [ 1, 2 ], [ 2, 3 ], [ 3, 99 ] ];
for (const [lo, hi] of buckets) {
  const g = rows.filter((r) => r.mfe >= lo && r.mfe < hi);
  if (!g.length) continue;
  const lost = g.filter((r) => r.pnl <= 0);
  console.log(`MFE ${lo}~${hi}%: n=${g.length} pnl=${g.reduce((a, r) => a + r.pnl, 0)} 손실로끝남=${lost.length} (손실합 ${lost.reduce((a, r) => a + r.pnl, 0)}) avgRet=${(g.reduce((a, r) => a + r.ret, 0) / g.length).toFixed(2)}%`);
}

console.log('\n[take-profit 도달(high) 건: 목표 +3% 이후 얼마나 더 갔나]');
const highs = rows.filter((r) => r.exit === 'high');
console.log(`n=${highs.length} avg MFE ${(highs.reduce((a, r) => a + r.mfe, 0) / highs.length).toFixed(2)}% avg 실현 ${(highs.reduce((a, r) => a + r.ret, 0) / highs.length).toFixed(2)}% (첫 하락틱 매도라 MFE-실현 차이 = 매도 슬리피지)`);

console.log('\n[low(손절) 건: 손절 전에 최고 얼마나 올랐나]');
const lows = rows.filter((r) => r.exit === 'low').sort((a, b) => b.mfe - a.mfe);
for (const r of lows) console.log(`  ${r.date} ${r.code} MFE ${r.mfe.toFixed(2)}% -> 손절 ${r.ret.toFixed(2)}% (${r.pnl}원, ${r.holdMin.toFixed(1)}분)`);
