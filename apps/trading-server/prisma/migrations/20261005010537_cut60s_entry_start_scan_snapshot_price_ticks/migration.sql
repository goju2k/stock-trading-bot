-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "scanSnapshot" JSONB;

-- AlterTable
ALTER TABLE "position_watchers" ADD COLUMN     "cut60sEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "trading_config" ADD COLUMN     "cut60sEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "entryStartHhmm" INTEGER NOT NULL DEFAULT 910;

-- CreateTable
CREATE TABLE "position_price_ticks" (
    "id" SERIAL NOT NULL,
    "positionWatcherId" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "position_price_ticks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "position_price_ticks_positionWatcherId_observedAt_idx" ON "position_price_ticks"("positionWatcherId", "observedAt");

-- AddForeignKey
ALTER TABLE "position_price_ticks" ADD CONSTRAINT "position_price_ticks_positionWatcherId_fkey" FOREIGN KEY ("positionWatcherId") REFERENCES "position_watchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
