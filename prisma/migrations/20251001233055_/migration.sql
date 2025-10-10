-- CreateEnum
CREATE TYPE "public"."UsageCategory" AS ENUM ('HEMAT', 'NORMAL', 'BOROS', 'UNKNOWN');

-- CreateTable
CREATE TABLE "public"."daily_usage_classifications" (
    "classification_id" SERIAL NOT NULL,
    "classification_date" DATE NOT NULL,
    "classification" "public"."UsageCategory" NOT NULL DEFAULT 'UNKNOWN',
    "confidence_score" DOUBLE PRECISION,
    "model_version" TEXT NOT NULL,
    "reasoning" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meter_id" INTEGER NOT NULL,
    "summary_id" INTEGER NOT NULL,

    CONSTRAINT "daily_usage_classifications_pkey" PRIMARY KEY ("classification_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_usage_classifications_summary_id_key" ON "public"."daily_usage_classifications"("summary_id");

-- CreateIndex
CREATE INDEX "daily_usage_classifications_summary_id_idx" ON "public"."daily_usage_classifications"("summary_id");

-- CreateIndex
CREATE INDEX "daily_usage_classifications_meter_id_idx" ON "public"."daily_usage_classifications"("meter_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_usage_classifications_classification_date_meter_id_key" ON "public"."daily_usage_classifications"("classification_date", "meter_id");

-- AddForeignKey
ALTER TABLE "public"."daily_usage_classifications" ADD CONSTRAINT "daily_usage_classifications_summary_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "public"."daily_summaries"("summary_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_usage_classifications" ADD CONSTRAINT "daily_usage_classifications_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;
