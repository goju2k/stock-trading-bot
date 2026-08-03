-- AlterTable
ALTER TABLE "trading_sessions" ADD COLUMN     "passedCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
