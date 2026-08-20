/*
  Warnings:

  - Changed the type of `category` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `severity` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."NotificationCategory" AS ENUM ('SYSTEM', 'THRESHOLD_BREACH', 'ANOMALY_DETECTED', 'MAINTENANCE', 'BUDGET_WARNING', 'DATA_ENTRY');

-- CreateEnum
CREATE TYPE "public"."NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."notifications" DROP COLUMN "category",
ADD COLUMN     "category" "public"."NotificationCategory" NOT NULL,
DROP COLUMN "severity",
ADD COLUMN     "severity" "public"."NotificationSeverity" NOT NULL;

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "public"."notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "public"."notifications"("created_at");

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
