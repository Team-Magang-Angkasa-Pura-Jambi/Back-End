/*
  Warnings:

  - You are about to drop the column `probability` on the `ml_classifications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[reading_session_id]` on the table `ml_classifications` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[daily_summary_id]` on the table `ml_classifications` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `ml_classifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `ml_predictions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."ml_classifications" DROP COLUMN "probability",
ADD COLUMN     "benchmark_value" DECIMAL(19,4),
ADD COLUMN     "confidence_score" DECIMAL(5,2),
ADD COLUMN     "deviation_percent" DECIMAL(8,2),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."ml_predictions" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ml_classifications_reading_session_id_key" ON "public"."ml_classifications"("reading_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "ml_classifications_daily_summary_id_key" ON "public"."ml_classifications"("daily_summary_id");
