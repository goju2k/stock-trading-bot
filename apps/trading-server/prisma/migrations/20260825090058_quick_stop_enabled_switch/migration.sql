-- AlterTable
ALTER TABLE "position_watchers" ADD COLUMN     "quickStopEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "trading_config" ADD COLUMN     "quickStopEnabled" BOOLEAN NOT NULL DEFAULT true;
