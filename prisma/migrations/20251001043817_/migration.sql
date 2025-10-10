/*
  Warnings:

  - You are about to drop the column `energy_type_id` on the `efficiency_targets` table. All the data in the column will be lost.
  - Added the required column `meter_id` to the `efficiency_targets` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."consumption_predictions" DROP CONSTRAINT "consumption_predictions_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."efficiency_targets" DROP CONSTRAINT "efficiency_targets_energy_type_id_fkey";

-- AlterTable
ALTER TABLE "public"."efficiency_targets" DROP COLUMN "energy_type_id",
ADD COLUMN     "meter_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "alerts_target_id_idx" ON "public"."alerts"("target_id");

-- CreateIndex
CREATE INDEX "efficiency_targets_meter_id_idx" ON "public"."efficiency_targets"("meter_id");

-- AddForeignKey
ALTER TABLE "public"."efficiency_targets" ADD CONSTRAINT "efficiency_targets_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consumption_predictions" ADD CONSTRAINT "consumption_predictions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;
