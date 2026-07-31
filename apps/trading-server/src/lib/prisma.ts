import { PrismaClient } from '@prisma/client';

// PrismaClient는 생성 시점에 DATABASE_URL을 읽는다. main.ts의 dotenv.config() 호출보다
// import가 먼저 평가되므로, 모듈 로드 시점에 즉시 생성하지 않고 최초 사용 시점까지 지연시킨다.
let client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}