/*
  Warnings:

  - You are about to drop the `events_logbook` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."events_logbook" DROP CONSTRAINT "events_logbook_reported_by_user_id_fkey";

-- DropTable
DROP TABLE "public"."events_logbook";

-- CreateTable
CREATE TABLE "public"."daily_logbooks" (
    "log_id" SERIAL NOT NULL,
    "log_date" DATE NOT NULL,
    "electricity_change_percent" DECIMAL(5,2),
    "water_change_percent" DECIMAL(5,2),
    "pax_change_percent" DECIMAL(5,2),
    "savings_value" DECIMAL(12,2),
    "savings_cost" DECIMAL(15,2),
    "overage_value" DECIMAL(12,2),
    "overage_cost" DECIMAL(15,2),
    "summary_notes" TEXT NOT NULL,
    "manual_notes" TEXT,
    "edited_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_logbooks_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_logbooks_log_date_key" ON "public"."daily_logbooks"("log_date");

-- AddForeignKey
ALTER TABLE "public"."daily_logbooks" ADD CONSTRAINT "daily_logbooks_edited_by_user_id_fkey" FOREIGN KEY ("edited_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
