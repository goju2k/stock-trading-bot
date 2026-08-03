/*
  Warnings:

  - Added the required column `highPercentage` to the `position_watchers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lowPercentage` to the `position_watchers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "position_watchers" ADD COLUMN     "highPercentage" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "lowPercentage" DOUBLE PRECISION NOT NULL;
