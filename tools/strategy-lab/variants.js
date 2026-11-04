// 매도 규칙 변형 비교. censored = 실제보다 오래 보유해야 해서 결과를 모르는 건(실제 결과로 채움)
const { run, BASE } = require('./sim');

const V = (o) => ({ ...BASE, ...o });
console.log('--- 기준');
run('BASE: TP 3% trailing / SL -4% / cut60', BASE);
console.log('--- 익절 목표 낮추기 (도달 후 첫 하락틱 매도)');
for (const tp of [ 1.5, 2, 2.5 ]) run(`TP ${tp}%`, V({ tpPct: tp }));
console.log('--- 본전 스탑 (고점이 +X% 넘으면 손절선을 매수가+lock 으로)');
for (const be of [ 1, 1.5, 2 ]) for (const lock of [ 0, 0.3 ]) run(`BE at +${be}% lock +${lock}%`, V({ breakevenAt: be, beLock: lock }));
console.log('--- 손절 폭 좁히기');
for (const sl of [ 2, 2.5, 3 ]) run(`SL -${sl}%`, V({ slPct: sl }));
console.log('--- 손절 폭 넓히기 (경로가 끊겨 대부분 censored - 참고만)');
run('SL -5%', V({ slPct: 5 }));
console.log('--- 시간 손절 (N분 지나도 매수가 아래면 매도)');
for (const m of [ 5, 10, 20 ]) run(`time stop ${m}m below entry`, V({ timeStopMin: m }));
console.log('--- 조합');
run('TP 2% + BE at +1.5%', V({ tpPct: 2, breakevenAt: 1.5 }));
run('TP 2.5% + BE at +1.5%', V({ tpPct: 2.5, breakevenAt: 1.5 }));
run('TP 2% + SL -3%', V({ tpPct: 2, slPct: 3 }));
run('TP 2.5% + BE +1.5% + SL -3%', V({ tpPct: 2.5, breakevenAt: 1.5, slPct: 3 }));
