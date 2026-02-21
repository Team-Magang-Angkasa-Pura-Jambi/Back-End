-- AlterTable
ALTER TABLE "public"."daily_summaries" ADD COLUMN     "is_manual_override" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."meters" ADD COLUMN     "allow_decrease" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allow_gap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rollover_limit" DECIMAL(19,4);
