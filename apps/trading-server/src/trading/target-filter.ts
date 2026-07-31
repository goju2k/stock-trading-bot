import { TradingConfig } from '@prisma/client';

import { VolumeRankItem } from '../kis/types';

// 기존 services/trading/src/pages/main/hooks/is-target-row.tsx 포팅.
export function isTargetRow(item: VolumeRankItem, config: Pick<TradingConfig, 'targetUpRating' | 'targetIncreaseRate'>) {
  const per = Number(item.prdy_ctrt);
  const inc = Number(item.vol_inrt);
  return per > config.targetUpRating && inc > config.targetIncreaseRate;
}