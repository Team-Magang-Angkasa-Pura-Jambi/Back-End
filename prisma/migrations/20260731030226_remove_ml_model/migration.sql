/*
  Warnings:

  - You are about to drop the column `mlModelModel_id` on the `meters` table. All the data in the column will be lost.
  - You are about to drop the `ml_models` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."MeterCategory" AS ENUM ('TERMINAL', 'KANTOR', 'LAINNYA');

-- DropForeignKey
ALTER TABLE "public"."meters" DROP CONSTRAINT "meters_mlModelModel_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ml_classifications" DROP CONSTRAINT "ml_classifications_model_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ml_predictions" DROP CONSTRAINT "ml_predictions_model_id_fkey";

-- AlterTable
ALTER TABLE "public"."meters" DROP COLUMN "mlModelModel_id",
ADD COLUMN     "category" "public"."MeterCategory" NOT NULL DEFAULT 'LAINNYA';

-- DropTable
DROP TABLE "public"."ml_models";
