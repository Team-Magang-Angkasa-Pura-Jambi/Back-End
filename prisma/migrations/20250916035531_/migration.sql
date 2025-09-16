/*
  Warnings:

  - A unique constraint covering the columns `[meter_id,reading_date]` on the table `READING_SESSIONS` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `reading_date` to the `READING_SESSIONS` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."READING_SESSIONS" ADD COLUMN     "reading_date" DATE NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "READING_SESSIONS_meter_id_reading_date_key" ON "public"."READING_SESSIONS"("meter_id", "reading_date");
