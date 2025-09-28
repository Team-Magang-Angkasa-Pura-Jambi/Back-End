/*
  Warnings:

  - A unique constraint covering the columns `[summary_id,energy_type_id,metric_name]` on the table `summary_details` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `metric_name` to the `summary_details` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."summary_details_summary_id_energy_type_id_key";

-- AlterTable
ALTER TABLE "public"."summary_details" ADD COLUMN     "metric_name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "summary_details_summary_id_energy_type_id_metric_name_key" ON "public"."summary_details"("summary_id", "energy_type_id", "metric_name");
