import { KisEnvName } from './env';

import { getPrisma } from '../lib/prisma';

export async function getStoredToken(env: KisEnvName) {
  return getPrisma().kisToken.findUnique({ where: { env } });
}

export async function saveToken(env: KisEnvName, accessToken: string, expiresAt: Date) {
  await getPrisma().kisToken.upsert({
    where: { env },
    create: { env, accessToken, expiresAt },
    update: { accessToken, expiresAt },
  });
}