import axios from 'axios';

import { nowKstTimestamp } from './date';

const PATCHED_METHODS = [ 'log', 'warn', 'error' ] as const;

// AxiosError를 그대로 console에 넘기면 요청 헤더(appkey/appsecret/Bearer 토큰)까지 통째로
// 덤프된다 - 2026-10-26 확인: 09:00 크론 실패 로그에 real 계정 appsecret과 토큰이 원문으로
// 남아 있었다. 원인 파악에 필요한 것(메서드/경로/상태/KIS 응답코드)만 한 줄로 요약한다.
function summarizeAxiosError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return error;
  }
  const data = error.response?.data as { rt_cd?: string; msg_cd?: string; msg1?: string; } | undefined;
  const parts = [
    `${error.config?.method?.toUpperCase() ?? '?'} ${error.config?.url ?? '?'}`,
    error.response ? `status ${error.response.status}` : undefined,
    error.code ? `code ${error.code}` : undefined,
    data?.rt_cd ? `rt_cd=${data.rt_cd}` : undefined,
    data?.msg_cd ? `msg_cd=${data.msg_cd}` : undefined,
    data?.msg1 ? `msg1=${data.msg1}` : undefined,
  ].filter(Boolean);
  return `AxiosError: ${error.message} (${parts.join(', ')})`;
}

// 배포 서버(docker logs)에 시간 정보 없이 로그가 찍혀서 언제 무슨 일이 있었는지 추적이 안 되는
// 문제 - console.log/warn/error를 한 번 패치해서 이후 모든 호출 앞에 KST 타임스탬프를 자동으로
// 붙인다. 호출부 수백 곳을 일일이 고치는 대신 진입점(main.ts)에서 한 번만 설치한다.
// 같은 자리에서 AxiosError 인자는 summarizeAxiosError()로 바꿔서 비밀값이 로그에 안 남게 한다.
export function installTimestampedConsole() {
  PATCHED_METHODS.forEach((method) => {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(`[${nowKstTimestamp()}]`, ...args.map(summarizeAxiosError));
    };
  });
}