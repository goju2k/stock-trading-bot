-- CreateTable
CREATE TABLE "minute_bars" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "barAt" TIMESTAMP(3) NOT NULL,
    "open" INTEGER NOT NULL,
    "high" INTEGER NOT NULL,
    "low" INTEGER NOT NULL,
    "close" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL,

    CONSTRAINT "minute_bars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "minute_bars_code_date_time_key" ON "minute_bars"("code", "date", "time");
