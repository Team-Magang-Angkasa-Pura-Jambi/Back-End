/*
  Warnings:

  - You are about to drop the column `electricity_change_percent` on the `daily_logbooks` table. All the data in the column will be lost.
  - You are about to drop the column `pax_change_percent` on the `daily_logbooks` table. All the data in the column will be lost.
  - You are about to drop the column `water_change_percent` on the `daily_logbooks` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[log_date,meter_id]` on the table `daily_logbooks` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `meter_id` to the `daily_logbooks` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."daily_logbooks_log_date_key";

-- AlterTable
ALTER TABLE "public"."daily_logbooks" DROP COLUMN "electricity_change_percent",
DROP COLUMN "pax_change_percent",
DROP COLUMN "water_change_percent",
ADD COLUMN     "consumption_change_percent" DECIMAL(5,2),
ADD COLUMN     "meter_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "daily_logbooks_log_date_meter_id_key" ON "public"."daily_logbooks"("log_date", "meter_id");

-- AddForeignKey
ALTER TABLE "public"."daily_logbooks" ADD CONSTRAINT "daily_logbooks_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;
