-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "kospiDeltaAtBuy" DOUBLE PRECISION,
ADD COLUMN     "viDprt" TEXT,
ADD COLUMN     "viKindCode" TEXT;

-- AlterTable
ALTER TABLE "position_watchers" ADD COLUMN     "kospiDeltaAtSell" DOUBLE PRECISION;
