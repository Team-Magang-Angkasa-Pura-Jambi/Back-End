-- CreateEnum
CREATE TYPE "public"."BugSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."BugStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."BugCategory" AS ENUM ('UI_BUG', 'CALCULATION_ERROR', 'API_FAILURE', 'DATA_MISMATCH', 'PERFORMANCE', 'FEATURE_REQUEST', 'OTHER');

-- CreateTable
CREATE TABLE "public"."system_settings" (
    "setting_id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("setting_id")
);

-- CreateTable
CREATE TABLE "public"."bug_reports" (
    "report_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "public"."BugCategory" NOT NULL DEFAULT 'UI_BUG',
    "severity" "public"."BugSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."BugStatus" NOT NULL DEFAULT 'OPEN',
    "page_url" TEXT,
    "browser_info" JSONB,
    "error_stack" TEXT,
    "screenshot_url" TEXT,
    "developer_response" TEXT,
    "reporter_id" INTEGER NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "public"."system_settings"("key");

-- AddForeignKey
ALTER TABLE "public"."system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_reports" ADD CONSTRAINT "bug_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
