import { fetchForeignInstitutionNetBuyTop } from '../kis';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 원본 데이터 자체가 장중 특정 시각에만 갱신되므로 5분이면 충분

let cache = new Set<string>();
let timer: NodeJS.Timeout | undefined;

async function refresh() {
  try {
    const rows = await fetchForeignInstitutionNetBuyTop();
    cache = new Set(rows.map((row) => row.mksc_shrn_iscd));
    console.log(`[foreign-institution-cache] refreshed: ${cache.size} code(s)`);
  } catch (error) {
    console.error('[foreign-institution-cache] refresh failed', error);
  }
}

export function startForeignInstitutionCache() {
  if (timer) return;
  const loop = async () => {
    await refresh();
    timer = setTimeout(loop, REFRESH_INTERVAL_MS);
  };
  loop();
}

export function stopForeignInstitutionCache() {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  cache = new Set();
}

export function isForeignInstitutionNetBuy(code: string) {
  return cache.has(code);
}