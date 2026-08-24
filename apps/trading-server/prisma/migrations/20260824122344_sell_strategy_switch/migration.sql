-- CreateEnum
CREATE TYPE "SellStrategy" AS ENUM ('trailing', 'tick_down');

-- AlterTable
ALTER TABLE "position_watchers" ADD COLUMN     "sellStrategy" "SellStrategy" NOT NULL DEFAULT 'trailing';

-- AlterTable
ALTER TABLE "trading_config" ADD COLUMN     "sellStrategy" "SellStrategy" NOT NULL DEFAULT 'trailing';
