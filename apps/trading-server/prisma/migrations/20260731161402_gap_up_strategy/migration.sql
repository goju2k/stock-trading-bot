-- AlterTable
ALTER TABLE "trading_config" ADD COLUMN     "gapScanWindowMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "gapStrategyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gapUpThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT 3;
