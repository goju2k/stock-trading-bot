-- AlterTable
ALTER TABLE "position_watchers" ADD COLUMN     "exitParams" JSONB,
ADD COLUMN     "experimentArm" TEXT,
ADD COLUMN     "experimentKey" TEXT;

-- AlterTable
ALTER TABLE "trading_config" ADD COLUMN     "experiment" JSONB;
