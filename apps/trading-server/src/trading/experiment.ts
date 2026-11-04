import { randomInt } from 'crypto';

// 매도 규칙 A/B 실험(2026-11-04). TradingConfig.experiment(Json)에 실험을 적어두면 매수할 때마다
// 그룹(arm)을 가중치대로 무작위 배정하고, 그 그룹의 매도 파라미터를 PositionWatcher 스냅샷에
// 덮어쓴다(experimentKey/experimentArm/exitParams로 기록). experiment가 null이면 아무것도 안 바뀐다.
//
// 건당 수익률 표준편차가 약 2.9%(9/1~10/30 644건)라 그룹당 0.8%p 차이를 보려면 약 210건, 0.5%p면
// 약 530건이 필요하다 - 규칙 탐색은 strategy-lab 오프라인 시뮬로 하고, 실거래 A/B는 변형 1개 vs
// 현행으로 시뮬 결과가 실제로도 맞는지 확인하는 데 쓴다. 그래서 그룹은 2개까지만 허용한다.
//
// 예: { "key": "2026-11-tp15-be1", "arms": [
//   { "name": "control", "weight": 1, "exit": {} },
//   { "name": "tp15_be1", "weight": 1, "exit": { "highPercentage": 1.5, "breakevenAtPct": 1 } } ] }

export interface ExitOverrides {
  // 기존 스냅샷 필드 덮어쓰기
  highPercentage?: number;
  lowPercentage?: number;
  quickStopEnabled?: boolean;
  cut60sEnabled?: boolean;
  // 본전스탑: 고점이 진입가 +breakevenAtPct% 이상 찍은 뒤로는 손절선을 진입가 +breakevenLockPct%(기본 0) 밑으로 안 내린다.
  breakevenAtPct?: number;
  breakevenLockPct?: number;
  // 시간손절: 매수 후 timeStopMin분이 지나도 익절선에 못 갔고 가격이 진입가 +timeStopRetPct%(기본 0) 미만이면 정리.
  timeStopMin?: number;
  timeStopRetPct?: number;
}

// PositionWatcher.exitParams로 영속화되는 "새 규칙" 파라미터(기존 컬럼에 없는 것만).
export type ExitParams = Pick<ExitOverrides, 'breakevenAtPct' | 'breakevenLockPct' | 'timeStopMin' | 'timeStopRetPct'>;

export interface ExperimentArm {
  name: string;
  weight: number;
  exit: ExitOverrides;
}

export interface Experiment {
  key: string;
  arms: ExperimentArm[];
}

const MAX_ARMS = 2;
const NUMBER_KEYS = [ 'highPercentage', 'lowPercentage', 'breakevenAtPct', 'breakevenLockPct', 'timeStopMin', 'timeStopRetPct' ] as const;
const BOOLEAN_KEYS = [ 'quickStopEnabled', 'cut60sEnabled' ] as const;
const NAME_PATTERN = /^[A-Za-z0-9_.-]{1,40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 설정 API 입력 검증 겸 런타임 파싱. 형식이 틀리면 Error - 실거래 매도 기준이라 모르는 키도 거부한다.
export function parseExperiment(value: unknown): Experiment | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error('experiment must be an object or null');
  const { key, arms } = value;
  if (typeof key !== 'string' || !NAME_PATTERN.test(key)) throw new Error('experiment.key must match [A-Za-z0-9_.-]{1,40}');
  if (!Array.isArray(arms) || arms.length < 2 || arms.length > MAX_ARMS) throw new Error(`experiment.arms must have exactly ${MAX_ARMS} arms`);

  const names = new Set<string>();
  const parsedArms = arms.map((arm, index): ExperimentArm => {
    if (!isRecord(arm)) throw new Error(`arms[${index}] must be an object`);
    const { name, weight, exit } = arm;
    if (typeof name !== 'string' || !NAME_PATTERN.test(name) || names.has(name)) throw new Error(`arms[${index}].name invalid or duplicated`);
    names.add(name);
    if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1 || weight > 100) throw new Error(`arms[${index}].weight must be an integer 1~100`);
    if (!isRecord(exit)) throw new Error(`arms[${index}].exit must be an object`);

    const parsedExit: ExitOverrides = {};
    Object.entries(exit).forEach(([ field, fieldValue ]) => {
      if ((NUMBER_KEYS as readonly string[]).includes(field)) {
        if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue) || fieldValue < 0 || fieldValue > 100) {
          throw new Error(`arms[${index}].exit.${field} must be a number 0~100`);
        }
        parsedExit[field as typeof NUMBER_KEYS[number]] = fieldValue;
      } else if ((BOOLEAN_KEYS as readonly string[]).includes(field)) {
        if (typeof fieldValue !== 'boolean') throw new Error(`arms[${index}].exit.${field} must be boolean`);
        parsedExit[field as typeof BOOLEAN_KEYS[number]] = fieldValue;
      } else {
        throw new Error(`arms[${index}].exit.${field} is not a supported exit parameter`);
      }
    });
    return { name, weight, exit: parsedExit };
  });

  return { key, arms: parsedArms };
}

// 가중치 비례 무작위 배정. pick(n)은 0 이상 n 미만 정수 - 테스트에서 주입.
export function assignArm(experiment: Experiment, pick: (n: number) => number = (n) => randomInt(n)): ExperimentArm {
  const total = experiment.arms.reduce((sum, arm) => sum + arm.weight, 0);
  let roll = pick(total);
  const found = experiment.arms.find((arm) => {
    roll -= arm.weight;
    return roll < 0;
  });
  return found ?? experiment.arms[experiment.arms.length - 1];
}

export function toExitParams(exit: ExitOverrides): ExitParams {
  const { breakevenAtPct, breakevenLockPct, timeStopMin, timeStopRetPct } = exit;
  return { breakevenAtPct, breakevenLockPct, timeStopMin, timeStopRetPct };
}