import { PositionWatcher } from './position-watcher';
import { TradingRuntime } from './runtime';
import { isTargetRow } from './target-filter';

import { getTradingConfig } from '../config/trading-config';
import { fetchVolumeRank, placeMarketOrder } from '../kis';
import { getPrisma } from '../lib/prisma';

let timer: NodeJS.Timeout | undefined;

// 기존 services/trading/src/hooks/kis-catch-stock-hook.tsx(useKisCatchStock) 포팅.
// refreshRateMs 간격으로 거래량 순위를 조회해서, 오늘 아직 안 산/안 지나친 종목 중
// 조건(isTargetRow)에 맞는 첫 종목 1개만 매수한다. 조회된 종목은 전부 오늘자 pass 처리해서
// "처음 리스트업 되는 매물만 잡는다"는 기존 동작을 그대로 유지한다.
async function tick(sessionId: number) {
  const config = await getTradingConfig();
  const prisma = getPrisma();

  if (!config.autoTradingEnabled) {
    return config;
  }

  const items = await fetchVolumeRank({
    minPrice: config.minTargetAmt,
    maxPrice: config.maxOrderAmt,
    minVolume: config.minTradingCount,
  });

  const session = await prisma.tradingSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return config;
  }

  const passed = new Set(session.passedCodes);
  const orderedToday = new Set(
    (await prisma.order.findMany({ where: { sessionId }, select: { code: true } })).map((o) => o.code),
  );

  const target = items.find(
    (item) => !orderedToday.has(item.mksc_shrn_iscd) && !passed.has(item.mksc_shrn_iscd) && isTargetRow(item, config),
  );

  if (target) {
    await tryBuy(sessionId, config, target);
  }

  const passedCodes = Array.from(new Set([ ...passed, ...items.map((item) => item.mksc_shrn_iscd) ]));
  await prisma.tradingSession.update({ where: { id: sessionId }, data: { passedCodes } });

  return config;
}

async function tryBuy(
  sessionId: number,
  config: Awaited<ReturnType<typeof getTradingConfig>>,
  target: Awaited<ReturnType<typeof fetchVolumeRank>>[number],
) {
  const prisma = getPrisma();
  const code = target.mksc_shrn_iscd;
  const price = Number(target.stck_prpr);
  const qty = Math.floor(config.maxOrderAmt / price);

  if (qty <= 0) {
    return;
  }

  const res = await placeMarketOrder({ buy: true, code, qty: String(qty) });

  if (res.rt_cd !== '0') {
    await prisma.tradeEvent.create({ data: { sessionId, type: 'buy_failed', code, message: `[${code}] 매수실패 ${res.msg1}` } });
    return;
  }

  const order = await prisma.order.create({
    data: {
      sessionId,
      code,
      name: target.hts_kor_isnm,
      buyPrice: price,
      qty,
      kisOrderNo: res.output.ODNO,
    },
  });

  await prisma.tradeEvent.create({ data: { sessionId, type: 'buy_executed', code, message: `[${code}] 매수완료 ${qty}주`, payload: { qty, price } } });

  const watcher = await PositionWatcher.start(order.id, code, config.highPercentage, config.lowPercentage, (w) => TradingRuntime.remove(w.code));
  TradingRuntime.add(watcher);
}

export function startScanner(sessionId: number) {
  if (timer) {
    return;
  }

  const loop = async () => {
    let refreshRateMs = 1000;
    try {
      const config = await tick(sessionId);
      refreshRateMs = config.refreshRateMs;
    } catch (error) {
      console.error('[scanner] tick failed', error);
    }
    timer = setTimeout(loop, refreshRateMs);
  };

  loop();
  console.log(`[scanner] started for session ${sessionId}`);
}

export function stopScanner() {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
    console.log('[scanner] stopped');
  }
}

export function isScannerRunning() {
  return !!timer;
}