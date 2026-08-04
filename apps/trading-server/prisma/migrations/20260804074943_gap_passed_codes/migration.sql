-- AlterTable
ALTER TABLE "trading_sessions" ADD COLUMN     "gapPassedCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
