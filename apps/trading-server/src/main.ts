import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';

// 워크스페이스 루트의 .env.local (git-ignored, FE의 VITE_* 와 같은 파일 공유)을 로드.
// Docker 배포 환경에는 이 파일이 없으므로 조용히 스킵되고 컨테이너의 실제 환경변수를 그대로 쓴다.
dotenv.config({ path: '.env.local' });

// eslint-disable-next-line import/first
import { startTradingCron } from './cron/schedule';
// eslint-disable-next-line import/first
import { resumeTodaySessionIfNeeded } from './cron/session';
// eslint-disable-next-line import/first
import { apiRouter } from './http/router';
// eslint-disable-next-line import/first
import { getPrisma } from './lib/prisma';
// eslint-disable-next-line import/first
import { BalancePoller } from './trading';

// 2026-08-02 사고: BalancePoller 리스너(비동기) 안에서 던진 예외가 unhandled rejection으로
// 새서 아무도 못 잡았고, 이 프로세스엔 별도 핸들러가 없어서(Node LTS 기본 동작 = 프로세스 종료)
// 매매 로직 전체가 조용히 죽었다가 다시 살아나지 못한 것으로 추정된다. 개별 호출부(try/catch)를
// 최대한 보강했지만, 놓친 경로가 또 있을 수 있으니 최후의 방어선으로 로그만 남기고 프로세스는
// 살려둔다 - 트레이딩 서버가 죽는 것보다 에러 하나 놓치는 게 훨씬 낫다.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[process] uncaught exception', error);
});

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'ok', db: 'error', message: (error as Error).message });
  }
});

app.use('/api', apiRouter);

// Express는 함수 arity(4개)로 에러 핸들러를 구분하므로 안 쓰는 _req/_next도 반드시 남겨야 한다.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[http] unhandled error', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(port, host, async () => {
  console.log(`[ ready ] trading-server http://${host}:${port}`);

  // 잔고 폴러는 프로세스 수명 전체에 걸쳐 1개만 존재 (리스너 없으면 자체적으로 idle).
  BalancePoller.run();

  // 2026-08-03 사고: 부팅 직후 DB 연결이 잠깐 끊겨서(Prisma 커넥션 풀 안정화 전 등) 이 호출이
  // 예외를 던졌는데, 이게 unhandledRejection 핸들러로만 잡히고 바로 아래 startTradingCron()은
  // 영원히 실행이 안 됐다 - 그 프로세스 수명 내내 09:00/15:25/16:00 cron 자체가 등록이 안 돼서
  // 그날 강제청산/세션종료가 통째로 스킵됐다. resume 실패가 cron 등록까지 막지 않도록 분리.
  try {
    await resumeTodaySessionIfNeeded();
  } catch (error) {
    console.error('[main] resumeTodaySessionIfNeeded failed - cron will still be registered', error);
  }
  startTradingCron();
});