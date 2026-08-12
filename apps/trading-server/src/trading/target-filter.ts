import { TradingConfig } from '@prisma/client';

import { VolumeRankItem } from '../kis/types';

// 기존 services/trading/src/pages/main/hooks/is-target-row.tsx 포팅.
export function isTargetRow(item: VolumeRankItem, config: Pick<TradingConfig, 'targetUpRating' | 'targetIncreaseRate'>) {
  const per = Number(item.prdy_ctrt);
  const inc = Number(item.vol_inrt);
  // 2026-08-13: 전일대비 상승률은 targetUpRating(7%) "이상"으로 포함시킨다(> -> >=) -
  // 정확히 7.00%인 종목이 경계값이라고 제외되는 걸 막기 위함.
  return per >= config.targetUpRating && inc > config.targetIncreaseRate;
}