import { TradingConfig } from '@prisma/client';

import { VolumeRankItem } from '../kis/types';

// vi-scanner.ts의 MAX_VI_DPRT_PERCENT와 같은 이유의 상한선 - 상한가(전일대비 +30%)에
// 바로 인접한 종목은 매수 시장가 주문을 넣어도 매도호가가 없어 체결이 안 되는 경우가 있다
// (2026-08-24 289080 SV인베스트먼트: buy_executed 로그와 kisOrderNo는 남았지만 watchForSell이
// 한 번도 안 불려서 하루 종일 잔고에 안 잡힘 - 헤드라인이 "上"(상한가)였음). vi-scanner는
// vi_dprt(15%)로 이미 걸러왔는데 target-filter.ts(volume_rank)는 하한(targetUpRating)만 있고
// 이 상한이 아예 없었다.
const MAX_UP_RATING_PERCENT = 17;

// 기존 services/trading/src/pages/main/hooks/is-target-row.tsx 포팅.
export function isTargetRow(item: VolumeRankItem, config: Pick<TradingConfig, 'targetUpRating' | 'targetIncreaseRate'>) {
  const per = Number(item.prdy_ctrt);
  const inc = Number(item.vol_inrt);
  // 2026-08-13: 전일대비 상승률은 targetUpRating(7%) "이상"으로 포함시킨다(> -> >=) -
  // 정확히 7.00%인 종목이 경계값이라고 제외되는 걸 막기 위함.
  return per >= config.targetUpRating && per < MAX_UP_RATING_PERCENT && inc > config.targetIncreaseRate;
}