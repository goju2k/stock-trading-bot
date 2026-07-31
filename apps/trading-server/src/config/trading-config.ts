import { getPrisma } from '../lib/prisma';

// 기존 AppConfig(shared/states/global) 대응. id=1 고정 싱글턴 행, 없으면 기본값으로 생성.
export async function getTradingConfig() {
  return getPrisma().tradingConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}