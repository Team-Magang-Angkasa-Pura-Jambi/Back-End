/*
  Warnings:

  - You are about to drop the column `metric_name` on the `summary_details` table. All the data in the column will be lost.
  - You are about to drop the column `metric_value` on the `summary_details` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[summary_id,energy_type_id]` on the table `summary_details` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `consumption_cost` to the `summary_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consumption_value` to the `summary_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `current_reading` to the `summary_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `energy_type_id` to the `summary_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `previous_reading` to the `summary_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."summary_details" DROP COLUMN "metric_name",
DROP COLUMN "metric_value",
ADD COLUMN     "consumption_cost" DECIMAL(15,2) NOT NULL,
ADD COLUMN     "consumption_value" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "current_reading" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "energy_type_id" INTEGER NOT NULL,
ADD COLUMN     "lwbp_value" DECIMAL(12,2),
ADD COLUMN     "previous_reading" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "wbp_value" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "daily_summaries_meter_id_idx" ON "public"."daily_summaries"("meter_id");

-- CreateIndex
CREATE INDEX "summary_details_summary_id_idx" ON "public"."summary_details"("summary_id");

-- CreateIndex
CREATE INDEX "summary_details_energy_type_id_idx" ON "public"."summary_details"("energy_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "summary_details_summary_id_energy_type_id_key" ON "public"."summary_details"("summary_id", "energy_type_id");

-- AddForeignKey
ALTER TABLE "public"."summary_details" ADD CONSTRAINT "summary_details_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;
