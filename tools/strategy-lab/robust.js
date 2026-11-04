// 후보 규칙이 기간 전반/후반, 일자별로 일관되게 나은지 확인
const { usable, simulate, BASE } = require('./sim');

const V = (o) => ({ ...BASE, ...o });
const cands = {
  'TP 1.5%': V({ tpPct: 1.5 }),
  'TP 2%': V({ tpPct: 2 }),
  'BE +1%': V({ breakevenAt: 1 }),
  'time 10m': V({ timeStopMin: 10 }),
  'TP 2% + BE +1.5%': V({ tpPct: 2, breakevenAt: 1.5 }),
  'TP 1.5% + BE +1%': V({ tpPct: 1.5, breakevenAt: 1 }),
};
const val = (p, r) => {
  const s = simulate(p, r);
  return s ? Math.round((s.price - p.entry) * p.qty) : p.pnl;
};
const days = [ ...new Set(usable.map((p) => p.date)) ].sort();
const half = days[Math.floor(days.length / 2)];
console.log(`전반 ${days[0]}~(${half} 전), 후반 ${half}~${days.at(-1)}`);
const baseBy = (f) => usable.filter(f).reduce((a, p) => a + val(p, BASE), 0);
const early = (p) => p.date < half; const late = (p) => p.date >= half;
console.log(`${'BASE'.padEnd(20)} 전반 ${baseBy(early)}  후반 ${baseBy(late)}`);
for (const [name, r] of Object.entries(cands)) {
  const e = usable.filter(early).reduce((a, p) => a + val(p, r), 0);
  const l = usable.filter(late).reduce((a, p) => a + val(p, r), 0);
  let better = 0; let worse = 0;
  for (const d of days) {
    const g = usable.filter((p) => p.date === d);
    const diff = g.reduce((a, p) => a + val(p, r) - val(p, BASE), 0);
    if (diff > 0) better += 1; else if (diff < 0) worse += 1;
  }
  console.log(`${name.padEnd(20)} 전반 ${e} (${e - baseBy(early) >= 0 ? '+' : ''}${e - baseBy(early)})  후반 ${l} (${l - baseBy(late) >= 0 ? '+' : ''}${l - baseBy(late)})  일자 개선 ${better}/악화 ${worse}`);
}
