import { Router } from 'express';

import { getPrisma } from '../../lib/prisma';
import { asyncHandler } from '../async-handler';

export const devicesRouter = Router();

// 안드로이드 웹뷰 앱이 네이티브 브릿지로부터 받은 FCM 토큰을 등록. 실제 푸시 발송은 Phase 5.
devicesRouter.post('/', asyncHandler(async (req, res) => {
  const { token, label } = req.body || {};
  if (typeof token !== 'string' || !token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  const saved = await getPrisma().deviceToken.upsert({
    where: { token },
    create: { token, label },
    update: { label },
  });
  res.json(saved);
}));

devicesRouter.delete('/:token', asyncHandler(async (req, res) => {
  await getPrisma().deviceToken.delete({ where: { token: req.params.token } }).catch(() => undefined);
  res.json({ ok: true });
}));