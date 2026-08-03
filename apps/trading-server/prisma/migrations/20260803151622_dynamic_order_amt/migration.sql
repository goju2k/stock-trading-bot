-- AlterTable
ALTER TABLE "trading_config" ADD COLUMN     "orderAmtPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
ADD COLUMN     "maxCandidatePrice" INTEGER NOT NULL DEFAULT 30000,
ALTER COLUMN "maxOrderAmt" SET DEFAULT 1000000;

-- maxOrderAmt는 이제 "동적 매수금액의 절대 상한선"으로 의미가 바뀌었다. 기존 싱글턴 행(id=1)의
-- 값(30000)을 그대로 두면 10% 계산값(예: 980,000원)이 전부 30,000원으로 깎여서 이번 변경이
-- 무의미해지므로, 기존 행도 새 기본값으로 맞춘다.
UPDATE "trading_config" SET "maxOrderAmt" = 1000000 WHERE "id" = 1;
