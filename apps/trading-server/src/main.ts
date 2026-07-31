import dotenv from 'dotenv';
import express from 'express';

// 워크스페이스 루트의 .env.local (git-ignored, FE의 VITE_* 와 같은 파일 공유)을 로드.
// Docker 배포 환경에는 이 파일이 없으므로 조용히 스킵되고 컨테이너의 실제 환경변수를 그대로 쓴다.
dotenv.config({ path: '.env.local' });

// eslint-disable-next-line import/first
import { startTradingCron } from './cron/schedule';
// eslint-disable-next-line import/first
import { resumeTodaySessionIfNeeded } from './cron/session';
// eslint-disable-next-line import/first
import { getPrisma } from './lib/prisma';
// eslint-disable-next-line import/first
import { BalancePoller } from './trading';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'ok', db: 'error', message: (error as Error).message });
  }
});

app.listen(port, host, async () => {
  console.log(`[ ready ] trading-server http://${host}:${port}`);

  // 잔고 폴러는 프로세스 수명 전체에 걸쳐 1개만 존재 (리스너 없으면 자체적으로 idle).
  BalancePoller.run();

  await resumeTodaySessionIfNeeded();
  startTradingCron();
});