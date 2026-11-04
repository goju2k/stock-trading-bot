import { assignArm, parseExperiment } from './experiment';

const VALID = {
  key: '2026-11-tp15-be1',
  arms: [
    { name: 'control', weight: 1, exit: {} },
    { name: 'tp15_be1', weight: 3, exit: { highPercentage: 1.5, breakevenAtPct: 1 } },
  ],
};

describe('parseExperiment', () => {
  it('null이면 실험 없음', () => {
    expect(parseExperiment(null)).toBeNull();
    expect(parseExperiment(undefined)).toBeNull();
  });

  it('정상 입력을 그대로 파싱한다', () => {
    expect(parseExperiment(VALID)).toEqual(VALID);
  });

  it('그룹 수, 이름 중복, 모르는 매도 키, 범위 밖 값을 거부한다', () => {
    expect(() => parseExperiment({ ...VALID, arms: [ VALID.arms[0] ] })).toThrow();
    expect(() => parseExperiment({ ...VALID, arms: [ ...VALID.arms, { name: 'c', weight: 1, exit: {} }] })).toThrow();
    expect(() => parseExperiment({ ...VALID, arms: [ VALID.arms[0], { ...VALID.arms[1], name: 'control' }] })).toThrow();
    expect(() => parseExperiment({ ...VALID, arms: [ VALID.arms[0], { name: 'x', weight: 1, exit: { sellStrategy: 'tick_down' } }] })).toThrow();
    expect(() => parseExperiment({ ...VALID, arms: [ VALID.arms[0], { name: 'x', weight: 1, exit: { lowPercentage: -1 } }] })).toThrow();
    expect(() => parseExperiment({ ...VALID, arms: [ VALID.arms[0], { name: 'x', weight: 0, exit: {} }] })).toThrow();
    expect(() => parseExperiment({ ...VALID, key: 'has space' })).toThrow();
  });
});

describe('assignArm', () => {
  it('가중치 비례로 배정한다 (1:3)', () => {
    const experiment = parseExperiment(VALID)!;
    expect(assignArm(experiment, () => 0).name).toBe('control');
    expect(assignArm(experiment, () => 1).name).toBe('tp15_be1');
    expect(assignArm(experiment, () => 3).name).toBe('tp15_be1');
  });

  it('기본 난수로 대략 비율이 맞는다', () => {
    const experiment = parseExperiment({ ...VALID, arms: [ VALID.arms[0], { ...VALID.arms[1], weight: 1 }] })!;
    let control = 0;
    for (let i = 0; i < 4000; i += 1) {
      if (assignArm(experiment).name === 'control') control += 1;
    }
    expect(control).toBeGreaterThan(1800);
    expect(control).toBeLessThan(2200);
  });
});