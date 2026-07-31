-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "sourceStrategy" TEXT NOT NULL DEFAULT 'volume_rank';

-- AlterTable
ALTER TABLE "position_watchers" ADD COLUMN     "peakPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "trading_config" ADD COLUMN     "requireForeignInstitutionNetBuy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "viStrategyEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "trading_sessions" ADD COLUMN     "viActedCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
