import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { getTradingConfig } from '../../config/trading-config';
import { getPrisma } from '../../lib/prisma';
import { parseExperiment } from '../../trading/experiment';
import { asyncHandler } from '../async-handler';

export const configRouter = Router();

const NUMBER_FIELDS = [
  'refreshRateMs', 'highPercentage', 'lowPercentage', 'maxOrderAmt', 'orderAmtPercent', 'minOrderAmtPercent', 'maxCandidatePrice',
  'minTargetAmt', 'minTradingCount', 'targetUpRating', 'targetIncreaseRate',
  'gapUpThresholdPercent', 'gapScanWindowMinutes', 'entryStartHhmm',
] as const;

// null을 허용하는 숫자 필드(null = 끔).
const NULLABLE_NUMBER_FIELDS = [ 'breakevenAtPct', 'breakevenLockPct' ] as const;

const BOOLEAN_FIELDS = [
  'autoTradingEnabled', 'requireForeignInstitutionNetBuy', 'viStrategyEnabled', 'gapStrategyEnabled', 'quickStopEnabled', 'cut60sEnabled',
] as const;

// 값이 정해진 문자열(enum) 필드 - 허용 목록에 없는 값은 거부한다.
const ENUM_FIELDS = { sellStrategy: [ 'trailing', 'tick_down' ] } as const;

// 기존 AdvanceOrder.tsx 설정 화면이 편집하던 필드 그대로. 실거래 금액/비율이라 최소한의
// 타입/범위 검증만 한다 (zod 등 별도 라이브러리 없이 이 레포 관례대로 손으로 체크).
type ConfigUpdate = Record<string, number | boolean | string | null | Prisma.InputJsonValue | typeof Prisma.JsonNull>;

function sanitizeConfigInput(body: Record<string, unknown>) {
  const data: ConfigUpdate = {};

  NUMBER_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`invalid value for ${field}`);
    }
    data[field] = value;
  });

  NULLABLE_NUMBER_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;
    if (body[field] === null) {
      data[field] = null;
      return;
    }
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`invalid value for ${field}`);
    }
    data[field] = value;
  });

  BOOLEAN_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;
    if (typeof body[field] !== 'boolean') {
      throw new Error(`${field} must be boolean`);
    }
    data[field] = body[field] as boolean;
  });

  (Object.keys(ENUM_FIELDS) as (keyof typeof ENUM_FIELDS)[]).forEach((field) => {
    if (body[field] === undefined) return;
    const allowed: readonly string[] = ENUM_FIELDS[field];
    if (typeof body[field] !== 'string' || !allowed.includes(body[field] as string)) {
      throw new Error(`invalid value for ${field}`);
    }
    data[field] = body[field] as string;
  });

  // 매도 규칙 A/B 실험 정의(trading/experiment.ts) - null을 보내면 실험 종료.
  if (body.experiment !== undefined) {
    const experiment = parseExperiment(body.experiment);
    data.experiment = experiment === null ? Prisma.JsonNull : (experiment as unknown as Prisma.InputJsonValue);
  }

  return data;
}

configRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await getTradingConfig());
}));

configRouter.put('/', asyncHandler(async (req, res) => {
  let data: ConfigUpdate;
  try {
    data = sanitizeConfigInput(req.body || {});
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'no editable fields provided' });
    return;
  }

  const updated = await getPrisma().tradingConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  res.json(updated);
}));