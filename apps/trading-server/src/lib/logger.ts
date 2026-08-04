import { nowKstTimestamp } from './date';

const PATCHED_METHODS = [ 'log', 'warn', 'error' ] as const;

// 배포 서버(docker logs)에 시간 정보 없이 로그가 찍혀서 언제 무슨 일이 있었는지 추적이 안 되는
// 문제 - console.log/warn/error를 한 번 패치해서 이후 모든 호출 앞에 KST 타임스탬프를 자동으로
// 붙인다. 호출부 수백 곳을 일일이 고치는 대신 진입점(main.ts)에서 한 번만 설치한다.
export function installTimestampedConsole() {
  PATCHED_METHODS.forEach((method) => {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(`[${nowKstTimestamp()}]`, ...args);
    };
  });
}