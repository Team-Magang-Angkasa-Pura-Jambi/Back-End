/*
  Warnings:

  - You are about to drop the column `initial_reading` on the `meters` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."daily_summaries" DROP CONSTRAINT "daily_summaries_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."efficiency_targets" DROP CONSTRAINT "efficiency_targets_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."meter_lifecycle_logs" DROP CONSTRAINT "meter_lifecycle_logs_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ml_predictions" DROP CONSTRAINT "ml_predictions_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ml_predictions" DROP CONSTRAINT "ml_predictions_model_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."reading_sessions" DROP CONSTRAINT "reading_sessions_meter_id_fkey";

-- DropIndex
DROP INDEX "public"."reading_sessions_reading_date_idx";

-- AlterTable
ALTER TABLE "public"."meters" DROP COLUMN "initial_reading";

-- AddForeignKey
ALTER TABLE "public"."reading_sessions" ADD CONSTRAINT "reading_sessions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ml_predictions" ADD CONSTRAINT "ml_predictions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ml_predictions" ADD CONSTRAINT "ml_predictions_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."ml_models"("model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_summaries" ADD CONSTRAINT "daily_summaries_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_lifecycle_logs" ADD CONSTRAINT "meter_lifecycle_logs_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."efficiency_targets" ADD CONSTRAINT "efficiency_targets_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;
