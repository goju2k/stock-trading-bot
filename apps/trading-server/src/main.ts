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
import { installTimestampedConsole } from './lib/logger';
// eslint-disable-next-line import/first
import { getPrisma } from './lib/prisma';
// eslint-disable-next-line import/first
import { BalancePoller } from './trading';
// eslint-disable-next-line import/first
import { DISCORD_COLOR, sendDiscordMessage } from './notify/discord';

// 이후 모든 console.log/warn/error에 KST 타임스탬프를 붙인다 - 이 파일에서 실제로 로그가
// 찍히기 시작하는 지점(아래 process.on 핸들러들)보다 앞이면 되므로 임포트 블록 바로 뒤에서 설치.
installTimestampedConsole();

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

// 컨테이너 기동 직후 DB 커넥션 풀이 아직 안 붙었을 수 있어 잠깐은 재시도해서 기회를 준다
// (최대 30초) - 그래도 안 되면 진짜 장애로 보고 boot 시퀀스를 실패시킨다.
async function waitForDatabaseReady(maxAttempts: number, delayMs: number): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      console.error(`[main] DB connectivity check failed (attempt ${attempt}/${maxAttempts})`, error);
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => { setTimeout(resolve, delayMs); });
    }
  }
}

app.listen(port, host, async () => {
  console.log(`[ ready ] trading-server http://${host}:${port}`);

  // 2026-08-03 사고: 부팅 시퀀스(DB 연결 → 세션 복구 → cron 등록) 중간에 하나라도 실패하면
  // (그날은 DB 순단) 서버가 반쪽짜리 상태로 계속 떠있을 이유가 없다 - 예전처럼 일부만 건너뛰고
  // 계속 돌면 "cron은 등록됐는데 세션은 복구 안 된" 상태로 아무도 모르게 방치된다. 이 블록
  // 전체를 하나로 묶어서, 뭐가 실패하든 디스코드로 알리고 프로세스를 내린다 - Jenkins는
  // 컨테이너가 뜨기만 하면 배포 성공으로 표시하므로 이 지점 아니면 아무도 알 방법이 없다.
  // 재기동 정책(--restart)이 없으므로 내려가면 그대로 멈춰있다 - 의도적인 선택: 절반만 도는
  // 것보다 완전히 멈춰서 눈에 띄는 게 낫다.
  try {
    // 잔고 폴러는 프로세스 수명 전체에 걸쳐 1개만 존재 (리스너 없으면 자체적으로 idle).
    BalancePoller.run();

    await waitForDatabaseReady(10, 3000);
    await resumeTodaySessionIfNeeded();
    startTradingCron();
  } catch (error) {
    console.error('[main] boot sequence failed - exiting', error);
    await sendDiscordMessage({
      title: '🔴 부팅 실패',
      description: `서버 부팅 중 오류가 발생해 프로세스를 종료합니다.\n${(error as Error).message}`,
      color: DISCORD_COLOR.red,
    });
    process.exit(1);
  }
});