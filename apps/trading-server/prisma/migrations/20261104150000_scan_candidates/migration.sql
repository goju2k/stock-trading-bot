-- CreateTable
CREATE TABLE "scan_candidates" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "rank" INTEGER NOT NULL,
    "candidateCount" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "attempted" BOOLEAN NOT NULL,
    "row" JSONB NOT NULL,

    CONSTRAINT "scan_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_candidates_sessionId_seenAt_idx" ON "scan_candidates"("sessionId", "seenAt");

-- AddForeignKey
ALTER TABLE "scan_candidates" ADD CONSTRAINT "scan_candidates_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "trading_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
