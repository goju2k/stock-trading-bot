-- CreateEnum
CREATE TYPE "KisEnv" AS ENUM ('paper', 'real');

-- CreateEnum
CREATE TYPE "PositionState" AS ENUM ('checking', 'watching_for_sell', 'sell_waiting', 'done', 'error');

-- CreateEnum
CREATE TYPE "TradeEventType" AS ENUM ('session_start', 'session_end', 'buy_executed', 'buy_failed', 'sell_executed', 'sell_failed', 'forced_liquidation', 'error');

-- CreateTable
CREATE TABLE "trading_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "refreshRateMs" INTEGER NOT NULL DEFAULT 1000,
    "highPercentage" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "lowPercentage" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "maxOrderAmt" INTEGER NOT NULL DEFAULT 30000,
    "minTargetAmt" INTEGER NOT NULL DEFAULT 4000,
    "minTradingCount" INTEGER NOT NULL DEFAULT 1000000,
    "targetUpRating" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "targetIncreaseRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "kisEnv" "KisEnv" NOT NULL DEFAULT 'paper',
    "autoTradingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_sessions" (
    "id" SERIAL NOT NULL,
    "sessionDate" DATE NOT NULL,
    "isBusinessDay" BOOLEAN NOT NULL,
    "kisEnv" "KisEnv" NOT NULL,
    "openedAt" TIMESTAMP(3),
    "liquidationAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "trading_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "buyPrice" DECIMAL(12,2) NOT NULL,
    "qty" INTEGER NOT NULL,
    "kisOrderNo" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_watchers" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "state" "PositionState" NOT NULL DEFAULT 'checking',
    "sellAmtHigh" DECIMAL(12,2),
    "sellAmtLow" DECIMAL(12,2),
    "highOrLow" TEXT,
    "stateMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_watchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_events" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER,
    "type" "TradeEventType" NOT NULL,
    "code" TEXT,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kis_tokens" (
    "env" "KisEnv" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kis_tokens_pkey" PRIMARY KEY ("env")
);

-- CreateIndex
CREATE UNIQUE INDEX "trading_sessions_sessionDate_key" ON "trading_sessions"("sessionDate");

-- CreateIndex
CREATE INDEX "orders_sessionId_code_idx" ON "orders"("sessionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "position_watchers_orderId_key" ON "position_watchers"("orderId");

-- CreateIndex
CREATE INDEX "trade_events_sessionId_idx" ON "trade_events"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "trading_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_watchers" ADD CONSTRAINT "position_watchers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_events" ADD CONSTRAINT "trade_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "trading_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
