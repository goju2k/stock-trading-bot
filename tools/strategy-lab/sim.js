// 매도 규칙 재시뮬레이션: position_price_ticks 가격 경로에 규칙을 적용해서 결과 비교.
// 경로는 실제 매도 시점에서 끝난다 -> 실제보다 "더 오래 보유"하는 규칙은 결과를 알 수 없음(censored).
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const ts = (s) => new Date(s.replace(' ', 'T') + 'Z').getTime();
const positions = fs.readFileSync(path.join(dir, 'positions.csv'), 'utf8').trim().split('\n').map((l) => {
  const [id, date, code, orderedAt, closedAt, entry, qty, exit, pnl, sellPrice, p60, peak] = l.split(',');
  return { id: +id, date, code, orderedAt: ts(orderedAt), closedAt: closedAt ? ts(closedAt) : null, entry: +entry, qty: +qty,
    exit, pnl: pnl === '' ? null : +pnl, sellPrice: sellPrice ? +sellPrice : null, p60: p60 ? +p60 : null, peak: peak ? +peak : null, ticks: [] };
});
const byId = new Map(positions.map((p) => [p.id, p]));
for (const l of fs.readFileSync(path.join(dir, 'ticks.csv'), 'utf8').trim().split('\n')) {
  const [id, at, price] = l.split(',');
  const p = byId.get(+id);
  if (p) p.ticks.push({ t: ts(at), price: +price });
}
const usable = positions.filter((p) => p.ticks.length > 0 && p.pnl !== null && p.sellPrice);

// rule: { slPct, tpPct, tpGiveback, quickStop, cut60s, breakevenAt, beLock, timeStopMin }
function simulate(p, r) {
  let peak = p.entry;
  let first = true;
  let cutChecked = false;
  for (const { t, price } of p.ticks) {
    const age = (t - p.orderedAt) / 1000;
    // 실제 코드는 매 초 폴링이라 60초 시점 가격(priceAt60s)으로 판단한다 - 틱 테이블은 가격이
    // 바뀔 때만 기록돼서, 60초를 넘긴 첫 틱 직전에 저장된 p60으로 먼저 판단한다.
    if (r.cut60s && !cutChecked && age >= 60) {
      cutChecked = true;
      if (p.p60 !== null && p.p60 <= p.entry) return { price: p.p60, why: 'cut_60s' };
    }
    if (first) {
      first = false;
      if (r.quickStop && price < p.entry) return { price, why: 'quick_stop' };
    }
    peak = Math.max(peak, price);
    const reached = peak >= p.entry * (1 + r.tpPct / 100);
    if (reached && price < peak * (1 - r.tpGiveback / 100) && price < peak) return { price, why: 'high' };
    let stop = peak * (1 - r.slPct / 100);
    if (r.breakevenAt && peak >= p.entry * (1 + r.breakevenAt / 100)) stop = Math.max(stop, p.entry * (1 + (r.beLock ?? 0) / 100));
    if (price <= stop) return { price, why: 'low' };
    if (r.timeStopMin && age >= r.timeStopMin * 60 && price < p.entry * (1 + (r.timeStopMinRet ?? 0) / 100)) return { price, why: 'time' };
  }
  // 60초 시점에 바로 팔린 건은 60초 이후 틱이 하나도 없다 (가격이 안 바뀐 채 매도) - p60으로 판단.
  if (r.cut60s && !cutChecked && p.p60 !== null && p.p60 <= p.entry) return { price: p.p60, why: 'cut_60s' };
  return null; // 경로 끝까지 청산 안 됨 = censored
}

const BASE = { slPct: 4, tpPct: 3, tpGiveback: 0, quickStop: false, cut60s: true };

function run(name, rule, { verbose = false } = {}) {
  let pnl = 0; let wins = 0; let n = 0; let censored = 0; let censoredActual = 0;
  const why = {};
  for (const p of usable) {
    const s = simulate(p, rule);
    if (!s) {
      censored += 1;
      censoredActual += p.pnl; // 모르니 실제 결과로 채움 (표시만)
      pnl += p.pnl; n += 1; if (p.pnl > 0) wins += 1;
      continue;
    }
    const v = Math.round((s.price - p.entry) * p.qty);
    pnl += v; n += 1; if (v > 0) wins += 1;
    why[s.why] = (why[s.why] ?? 0) + 1;
  }
  console.log(`${name.padEnd(42)} pnl ${String(pnl).padStart(9)}  win ${(100 * wins / n).toFixed(1).padStart(5)}%  censored ${String(censored).padStart(3)}  ${JSON.stringify(why)}`);
  return { pnl, censored };
}

module.exports = { positions, usable, simulate, run, BASE };

if (require.main === module) {
  console.log(`positions ${positions.length}, with ticks+pnl ${usable.length}`);
  const actual = usable.reduce((a, p) => a + p.pnl, 0);
  console.log(`actual pnl (usable) ${actual}`);
  run('BASE (현재 규칙 재현)', BASE);
  // 건별로 실제 청산 사유와 시뮬레이션 사유가 같은지
  let same = 0; let diff = 0; const mism = {};
  for (const p of usable) {
    const s = simulate(p, BASE);
    const w = s ? s.why : '(censored)';
    const a = p.exit || '(none)';
    if (w === a || (w === '(censored)' && a === '(none)')) same += 1; else { diff += 1; mism[`${a}->${w}`] = (mism[`${a}->${w}`] ?? 0) + 1; }
  }
  console.log('exit reason match', same, 'mismatch', diff, mism);
}
