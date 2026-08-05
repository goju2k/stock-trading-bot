-- AlterTable
-- TradingConfig.kisEnv는 코드 어디에서도 읽히지 않는 죽은 컬럼이었다(실제 환경 전환은
-- KIS_ENV 환경변수로 이루어짐, kis/env.ts 참고) - 혼동을 줄 수 있어 삭제.
ALTER TABLE "trading_config" DROP COLUMN "kisEnv";
