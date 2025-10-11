/*
  Warnings:

  - Added the required column `description` to the `alerts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `alerts` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."alerts" DROP CONSTRAINT "alerts_target_id_fkey";

-- AlterTable
ALTER TABLE "public"."alerts" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "meter_id" INTEGER,
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "actual_value" DROP NOT NULL,
ALTER COLUMN "target_value_at_trigger" DROP NOT NULL,
ALTER COLUMN "target_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "alerts_meter_id_idx" ON "public"."alerts"("meter_id");

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."efficiency_targets"("target_id") ON DELETE SET NULL ON UPDATE CASCADE;
