/*
  Warnings:

  - You are about to drop the column `reading_type_id` on the `meter_reading_configs` table. All the data in the column will be lost.
  - You are about to drop the column `initial_reading` on the `meters` table. All the data in the column will be lost.
  - You are about to drop the column `multiplier` on the `meters` table. All the data in the column will be lost.
  - You are about to drop the column `reading_type_id` on the `reading_details` table. All the data in the column will be lost.
  - You are about to drop the column `reading_type_id` on the `scheme_rates` table. All the data in the column will be lost.
  - You are about to drop the `reading_types` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[meter_id,attr_id]` on the table `meter_reading_configs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `attr_id` to the `meter_reading_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `attr_id` to the `reading_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `attr_id` to the `scheme_rates` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."MlModelType" AS ENUM ('PREDICTION', 'CLASSIFICATION', 'ANOMALY_DETECTION');

-- DropForeignKey
ALTER TABLE "public"."meter_reading_configs" DROP CONSTRAINT "meter_reading_configs_reading_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."reading_details" DROP CONSTRAINT "reading_details_reading_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."reading_types" DROP CONSTRAINT "reading_types_energy_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."scheme_rates" DROP CONSTRAINT "scheme_rates_reading_type_id_fkey";

-- DropIndex
DROP INDEX "public"."meter_reading_configs_meter_id_reading_type_id_key";

-- AlterTable
ALTER TABLE "public"."meter_reading_configs" DROP COLUMN "reading_type_id",
ADD COLUMN     "attr_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."meters" DROP COLUMN "initial_reading",
DROP COLUMN "multiplier";

-- AlterTable
ALTER TABLE "public"."reading_details" DROP COLUMN "reading_type_id",
ADD COLUMN     "attr_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."scheme_rates" DROP COLUMN "reading_type_id",
ADD COLUMN     "attr_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."reading_types";

-- CreateTable
CREATE TABLE "public"."attribute_definitions" (
    "attr_id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("attr_id")
);

-- CreateTable
CREATE TABLE "public"."meter_spec_values" (
    "spec_id" SERIAL NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "attr_id" INTEGER NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "meter_spec_values_pkey" PRIMARY KEY ("spec_id")
);

-- CreateTable
CREATE TABLE "public"."pax_data" (
    "pax_id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "pax_count" INTEGER NOT NULL DEFAULT 0,
    "location_id" INTEGER,
    "session_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pax_data_pkey" PRIMARY KEY ("pax_id")
);

-- CreateTable
CREATE TABLE "public"."ml_models" (
    "model_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" "public"."MlModelType" NOT NULL DEFAULT 'PREDICTION',
    "description" TEXT,
    "accuracy_score" DECIMAL(5,4),
    "last_trained" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_models_pkey" PRIMARY KEY ("model_id")
);

-- CreateTable
CREATE TABLE "public"."ml_predictions" (
    "prediction_id" SERIAL NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "model_id" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "predicted_value" DECIMAL(19,4) NOT NULL,
    "confidence_low" DECIMAL(19,4),
    "confidence_high" DECIMAL(19,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_predictions_pkey" PRIMARY KEY ("prediction_id")
);

-- CreateTable
CREATE TABLE "public"."ml_classifications" (
    "classification_id" SERIAL NOT NULL,
    "model_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reading_session_id" INTEGER,
    "daily_summary_id" INTEGER,

    CONSTRAINT "ml_classifications_pkey" PRIMARY KEY ("classification_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_slug_key" ON "public"."attribute_definitions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "meter_spec_values_meter_id_attr_id_key" ON "public"."meter_spec_values"("meter_id", "attr_id");

-- CreateIndex
CREATE UNIQUE INDEX "pax_data_date_location_id_session_id_key" ON "public"."pax_data"("date", "location_id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "ml_predictions_meter_id_model_id_target_date_key" ON "public"."ml_predictions"("meter_id", "model_id", "target_date");

-- CreateIndex
CREATE UNIQUE INDEX "meter_reading_configs_meter_id_attr_id_key" ON "public"."meter_reading_configs"("meter_id", "attr_id");

-- AddForeignKey
ALTER TABLE "public"."meter_spec_values" ADD CONSTRAINT "meter_spec_values_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_spec_values" ADD CONSTRAINT "meter_spec_values_attr_id_fkey" FOREIGN KEY ("attr_id") REFERENCES "public"."attribute_definitions"("attr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_reading_configs" ADD CONSTRAINT "meter_reading_configs_attr_id_fkey" FOREIGN KEY ("attr_id") REFERENCES "public"."attribute_definitions"("attr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_details" ADD CONSTRAINT "reading_details_attr_id_fkey" FOREIGN KEY ("attr_id") REFERENCES "public"."attribute_definitions"("attr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pax_data" ADD CONSTRAINT "pax_data_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pax_data" ADD CONSTRAINT "pax_data_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."reading_sessions"("session_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ml_predictions" ADD CONSTRAINT "ml_predictions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ml_predictions" ADD CONSTRAINT "ml_predictions_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."ml_models"("model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ml_classifications" ADD CONSTRAINT "ml_classifications_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."ml_models"("model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ml_classifications" ADD CONSTRAINT "ml_classifications_reading_session_id_fkey" FOREIGN KEY ("reading_session_id") REFERENCES "public"."reading_sessions"("session_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ml_classifications" ADD CONSTRAINT "ml_classifications_daily_summary_id_fkey" FOREIGN KEY ("daily_summary_id") REFERENCES "public"."daily_summaries"("summary_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheme_rates" ADD CONSTRAINT "scheme_rates_attr_id_fkey" FOREIGN KEY ("attr_id") REFERENCES "public"."attribute_definitions"("attr_id") ON DELETE RESTRICT ON UPDATE CASCADE;
