-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "viReleaseHour" TEXT;

-- AlterTable
ALTER TABLE "position_watchers" ADD COLUMN     "priceAt60s" DECIMAL(12,2);
