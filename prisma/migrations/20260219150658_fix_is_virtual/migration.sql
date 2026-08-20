/*
  Warnings:

  - You are about to drop the column `is_virtual` on the `daily_summaries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."daily_summaries" DROP COLUMN "is_virtual";

-- AlterTable
ALTER TABLE "public"."meters" ADD COLUMN     "is_virtual" BOOLEAN NOT NULL DEFAULT false;
