import http from 'http';
import { AddressInfo } from 'net';

import { getKisClient } from './client';

// DB 대신 메모리에 토큰을 저장한다 (client.ts는 token-store를 통해서만 DB에 접근).
const storedTokens = new Map<string, { accessToken: string; expiresAt: Date; }>();
jest.mock('./token-store', () => ({
  getStoredToken: async (env: string) => storedTokens.get(env) ?? null,
  saveToken: async (env: string, accessToken: string, expiresAt: Date) => {
    storedTokens.set(env, { accessToken, expiresAt });
  },
}));

// 테스트에선 요청 간격 강제를 끈다.
jest.mock('./request-queue', () => ({ scheduleKisRequest: <T>(_env: string, fn: () => Promise<T>) => fn() }));

// 가짜 KIS 서버: tokenP는 매번 새 토큰을 주고, 조회 API는 가장 최근 토큰만 유효로 본다
// (그 외 토큰엔 실제 KIS처럼 HTTP 500 + EGW00123).
let issuedCount = 0;
let currentToken = '';
const seenAuthHeaders: string[] = [];
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  if (req.url?.startsWith('/oauth2/tokenP')) {
    issuedCount += 1;
    currentToken = `token-${issuedCount}`;
    res.end(JSON.stringify({ access_token: currentToken, expires_in: 86400 }));
    return;
  }
  const auth = String(req.headers.authorization ?? '');
  seenAuthHeaders.push(auth);
  if (auth !== `Bearer ${currentToken}`) {
    res.statusCode = 500;
    res.end(JSON.stringify({ rt_cd: '1', msg_cd: 'EGW00123', msg1: '기간이 만료된 token 입니다.' }));
    return;
  }
  res.end(JSON.stringify({ rt_cd: '0', msg_cd: 'OK', msg1: 'ok', output: [] }));
});

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  process.env.KIS_REAL_HOST = `http://127.0.0.1:${port}`;
  process.env.KIS_REAL_APP_KEY = 'test-key';
  process.env.KIS_REAL_APP_SECRET = 'test-secret';
  process.env.KIS_REAL_CANO = '00000000';
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('getKisClient', () => {
  it('rebuilds a cached client whose token has expired instead of reusing it', async () => {
    const realNow = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(realNow);

    const first = await getKisClient('real');
    expect(issuedCount).toBe(1);

    // 하루가 지나 캐시된 토큰이 만료된 상황 (2026-10-26 사고의 09:00 chk-holiday 호출)
    nowSpy.mockReturnValue(realNow + 25 * 60 * 60 * 1000);
    const second = await getKisClient('real');
    expect(second).not.toBe(first);
    expect(issuedCount).toBe(2);

    const res = await second.get('uapi/test');
    expect(res.data.rt_cd).toBe('0');
    nowSpy.mockRestore();
  });

  it('refreshes the token and retries the request once when KIS rejects it as expired', async () => {
    const client = await getKisClient('real');
    // KIS 쪽에서 토큰이 먼저 무효가 된 상황 - 서버만 새 토큰으로 바꾼다
    currentToken = 'revoked-by-server';
    const before = issuedCount;
    seenAuthHeaders.length = 0;

    const res = await client.get('uapi/test');

    expect(res.data.rt_cd).toBe('0');
    expect(issuedCount).toBe(before + 1);
    expect(seenAuthHeaders).toEqual([ expect.any(String), `Bearer token-${before + 1}` ]);
  });
});