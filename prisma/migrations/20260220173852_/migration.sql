/*
  Warnings:

  - You are about to drop the column `attr_id` on the `meter_reading_configs` table. All the data in the column will be lost.
  - You are about to drop the column `attr_id` on the `reading_details` table. All the data in the column will be lost.
  - You are about to drop the column `attr_id` on the `scheme_rates` table. All the data in the column will be lost.
  - You are about to drop the `attribute_definitions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `meter_spec_values` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[meter_id,reading_type_id]` on the table `meter_reading_configs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `reading_type_id` to the `meter_reading_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reading_type_id` to the `reading_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reading_type_id` to the `scheme_rates` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."daily_summaries" DROP CONSTRAINT "daily_summaries_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."efficiency_targets" DROP CONSTRAINT "efficiency_targets_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."meter_lifecycle_logs" DROP CONSTRAINT "meter_lifecycle_logs_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."meter_reading_configs" DROP CONSTRAINT "meter_reading_configs_attr_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."meter_spec_values" DROP CONSTRAINT "meter_spec_values_attr_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."meter_spec_values" DROP CONSTRAINT "meter_spec_values_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ml_predictions" DROP CONSTRAINT "ml_predictions_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ml_predictions" DROP CONSTRAINT "ml_predictions_model_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."reading_details" DROP CONSTRAINT "reading_details_attr_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."reading_sessions" DROP CONSTRAINT "reading_sessions_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."scheme_rates" DROP CONSTRAINT "scheme_rates_attr_id_fkey";

-- DropIndex
DROP INDEX "public"."meter_reading_configs_meter_id_attr_id_key";

-- AlterTable
ALTER TABLE "public"."meter_reading_configs" DROP COLUMN "attr_id",
ADD COLUMN     "reading_type_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."meters" ADD COLUMN     "initial_reading" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "multiplier" DECIMAL(10,4) NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "public"."reading_details" DROP COLUMN "attr_id",
ADD COLUMN     "reading_type_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."scheme_rates" DROP COLUMN "attr_id",
ADD COLUMN     "reading_type_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."attribute_definitions";

-- DropTable
DROP TABLE "public"."meter_spec_values";

-- CreateTable
CREATE TABLE "public"."reading_types" (
    "reading_type_id" SERIAL NOT NULL,
    "energy_type_id" INTEGER NOT NULL,
    "type_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "reading_types_pkey" PRIMARY KEY ("reading_type_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reading_types_type_name_energy_type_id_key" ON "public"."reading_types"("type_name", "energy_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "meter_reading_configs_meter_id_reading_type_id_key" ON "public"."meter_reading_configs"("meter_id", "reading_type_id");

-- CreateIndex
CREATE INDEX "reading_sessions_reading_date_idx" ON "public"."reading_sessions"("reading_date");

-- AddForeignKey
ALTER TABLE "public"."reading_types" ADD CONSTRAINT "reading_types_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_reading_configs" ADD CONSTRAINT "meter_reading_configs_reading_type_id_fkey" FOREIGN KEY ("reading_type_id") REFERENCES "public"."reading_types"("reading_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_sessions" ADD CONSTRAINT "reading_sessions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_details" ADD CONSTRAINT "reading_details_reading_type_id_fkey" FOREIGN KEY ("reading_type_id") REFERENCES "public"."reading_types"("reading_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheme_rates" ADD CONSTRAINT "scheme_rates_reading_type_id_fkey" FOREIGN KEY ("reading_type_id") REFERENCES "public"."reading_types"("reading_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ml_predictions" ADD CONSTRAINT "ml_predictions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ml_predictions" ADD CONSTRAINT "ml_predictions_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."ml_models"("model_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_summaries" ADD CONSTRAINT "daily_summaries_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_lifecycle_logs" ADD CONSTRAINT "meter_lifecycle_logs_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."efficiency_targets" ADD CONSTRAINT "efficiency_targets_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;
