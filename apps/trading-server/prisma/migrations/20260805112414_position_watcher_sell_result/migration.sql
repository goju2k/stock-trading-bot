-- AlterTable
ALTER TABLE "position_watchers" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "pnl" INTEGER,
ADD COLUMN     "sellPrice" DECIMAL(12,2),
ADD COLUMN     "sellQty" INTEGER;
