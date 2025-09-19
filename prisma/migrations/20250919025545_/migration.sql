/*
  Warnings:

  - You are about to drop the `ALERTS` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EFFICIENCY_TARGETS` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ENERGY_TYPES` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EVENTS_LOGBOOK` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `METERS` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PAX_DATA` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PRICE_SCHEMES` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `READING_DETAILS` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `READING_SESSIONS` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `READING_TYPES` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ROLES` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SCHEME_RATES` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `USERS` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."InsightSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."InsightStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'RESOLVED');

-- DropForeignKey
ALTER TABLE "public"."ALERTS" DROP CONSTRAINT "ALERTS_acknowledged_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ALERTS" DROP CONSTRAINT "ALERTS_target_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."EFFICIENCY_TARGETS" DROP CONSTRAINT "EFFICIENCY_TARGETS_energy_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."EFFICIENCY_TARGETS" DROP CONSTRAINT "EFFICIENCY_TARGETS_set_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."EVENTS_LOGBOOK" DROP CONSTRAINT "EVENTS_LOGBOOK_reported_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."METERS" DROP CONSTRAINT "METERS_energy_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."PRICE_SCHEMES" DROP CONSTRAINT "PRICE_SCHEMES_energy_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."PRICE_SCHEMES" DROP CONSTRAINT "PRICE_SCHEMES_set_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."READING_DETAILS" DROP CONSTRAINT "READING_DETAILS_reading_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."READING_DETAILS" DROP CONSTRAINT "READING_DETAILS_session_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."READING_SESSIONS" DROP CONSTRAINT "READING_SESSIONS_is_correction_for_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."READING_SESSIONS" DROP CONSTRAINT "READING_SESSIONS_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."READING_SESSIONS" DROP CONSTRAINT "READING_SESSIONS_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."READING_TYPES" DROP CONSTRAINT "READING_TYPES_energy_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."SCHEME_RATES" DROP CONSTRAINT "SCHEME_RATES_scheme_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."USERS" DROP CONSTRAINT "USERS_role_id_fkey";

-- DropTable
DROP TABLE "public"."ALERTS";

-- DropTable
DROP TABLE "public"."EFFICIENCY_TARGETS";

-- DropTable
DROP TABLE "public"."ENERGY_TYPES";

-- DropTable
DROP TABLE "public"."EVENTS_LOGBOOK";

-- DropTable
DROP TABLE "public"."METERS";

-- DropTable
DROP TABLE "public"."PAX_DATA";

-- DropTable
DROP TABLE "public"."PRICE_SCHEMES";

-- DropTable
DROP TABLE "public"."READING_DETAILS";

-- DropTable
DROP TABLE "public"."READING_SESSIONS";

-- DropTable
DROP TABLE "public"."READING_TYPES";

-- DropTable
DROP TABLE "public"."ROLES";

-- DropTable
DROP TABLE "public"."SCHEME_RATES";

-- DropTable
DROP TABLE "public"."USERS";

-- CreateTable
CREATE TABLE "public"."users" (
    "user_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "photo_profile_url" TEXT,
    "role_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "role_id" SERIAL NOT NULL,
    "role_name" "public"."RoleName" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "public"."energy_types" (
    "energy_type_id" SERIAL NOT NULL,
    "type_name" TEXT NOT NULL,
    "unit_of_measurement" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "energy_types_pkey" PRIMARY KEY ("energy_type_id")
);

-- CreateTable
CREATE TABLE "public"."meters" (
    "meter_id" SERIAL NOT NULL,
    "meter_code" TEXT NOT NULL,
    "location" TEXT,
    "status" "public"."MeterStatus" NOT NULL DEFAULT 'Active',
    "energy_type_id" INTEGER NOT NULL,

    CONSTRAINT "meters_pkey" PRIMARY KEY ("meter_id")
);

-- CreateTable
CREATE TABLE "public"."reading_sessions" (
    "session_id" SERIAL NOT NULL,
    "reading_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_correction_for_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "public"."reading_types" (
    "reading_type_id" SERIAL NOT NULL,
    "type_name" TEXT NOT NULL,
    "energy_type_id" INTEGER NOT NULL,

    CONSTRAINT "reading_types_pkey" PRIMARY KEY ("reading_type_id")
);

-- CreateTable
CREATE TABLE "public"."reading_details" (
    "detail_id" SERIAL NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "session_id" INTEGER NOT NULL,
    "reading_type_id" INTEGER NOT NULL,

    CONSTRAINT "reading_details_pkey" PRIMARY KEY ("detail_id")
);

-- CreateTable
CREATE TABLE "public"."price_schemes" (
    "scheme_id" SERIAL NOT NULL,
    "scheme_name" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "energy_type_id" INTEGER NOT NULL,
    "set_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "price_schemes_pkey" PRIMARY KEY ("scheme_id")
);

-- CreateTable
CREATE TABLE "public"."scheme_rates" (
    "rate_id" SERIAL NOT NULL,
    "rate_name" TEXT NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "rate_type" "public"."RateType" NOT NULL,
    "scheme_id" INTEGER NOT NULL,

    CONSTRAINT "scheme_rates_pkey" PRIMARY KEY ("rate_id")
);

-- CreateTable
CREATE TABLE "public"."efficiency_targets" (
    "target_id" SERIAL NOT NULL,
    "kpi_name" TEXT NOT NULL,
    "target_value" DECIMAL(10,2) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "energy_type_id" INTEGER NOT NULL,
    "set_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "efficiency_targets_pkey" PRIMARY KEY ("target_id")
);

-- CreateTable
CREATE TABLE "public"."pax_data" (
    "pax_id" SERIAL NOT NULL,
    "data_date" DATE NOT NULL,
    "total_pax" INTEGER NOT NULL,

    CONSTRAINT "pax_data_pkey" PRIMARY KEY ("pax_id")
);

-- CreateTable
CREATE TABLE "public"."events_logbook" (
    "event_id" SERIAL NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL,
    "reported_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "events_logbook_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "public"."alerts" (
    "alert_id" SERIAL NOT NULL,
    "actual_value" DECIMAL(12,2) NOT NULL,
    "target_value_at_trigger" DECIMAL(12,2) NOT NULL,
    "status" "public"."AlertStatus" NOT NULL DEFAULT 'NEW',
    "alert_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target_id" INTEGER NOT NULL,
    "acknowledged_by_user_id" INTEGER,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("alert_id")
);

-- CreateTable
CREATE TABLE "public"."daily_summaries" (
    "summary_id" SERIAL NOT NULL,
    "summary_date" DATE NOT NULL,
    "total_pax" INTEGER,
    "total_cost" DECIMAL(15,2),
    "meter_id" INTEGER NOT NULL,

    CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("summary_id")
);

-- CreateTable
CREATE TABLE "public"."summary_details" (
    "detail_id" SERIAL NOT NULL,
    "metric_name" TEXT NOT NULL,
    "metric_value" DECIMAL(12,2) NOT NULL,
    "summary_id" INTEGER NOT NULL,

    CONSTRAINT "summary_details_pkey" PRIMARY KEY ("detail_id")
);

-- CreateTable
CREATE TABLE "public"."analytics_insights" (
    "insight_id" SERIAL NOT NULL,
    "insight_date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "public"."InsightSeverity" NOT NULL DEFAULT 'LOW',
    "status" "public"."InsightStatus" NOT NULL DEFAULT 'NEW',
    "source_data_ref" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meter_id" INTEGER,
    "acknowledged_by_user_id" INTEGER,

    CONSTRAINT "analytics_insights_pkey" PRIMARY KEY ("insight_id")
);

-- CreateTable
CREATE TABLE "public"."consumption_predictions" (
    "prediction_id" SERIAL NOT NULL,
    "prediction_date" DATE NOT NULL,
    "predicted_value" DECIMAL(12,2) NOT NULL,
    "confidence_lower_bound" DECIMAL(12,2),
    "confidence_upper_bound" DECIMAL(12,2),
    "model_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meter_id" INTEGER NOT NULL,

    CONSTRAINT "consumption_predictions_pkey" PRIMARY KEY ("prediction_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "public"."roles"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "energy_types_type_name_key" ON "public"."energy_types"("type_name");

-- CreateIndex
CREATE UNIQUE INDEX "meters_meter_code_key" ON "public"."meters"("meter_code");

-- CreateIndex
CREATE UNIQUE INDEX "reading_sessions_is_correction_for_id_key" ON "public"."reading_sessions"("is_correction_for_id");

-- CreateIndex
CREATE UNIQUE INDEX "reading_sessions_meter_id_reading_date_key" ON "public"."reading_sessions"("meter_id", "reading_date");

-- CreateIndex
CREATE UNIQUE INDEX "reading_types_type_name_key" ON "public"."reading_types"("type_name");

-- CreateIndex
CREATE UNIQUE INDEX "price_schemes_scheme_name_key" ON "public"."price_schemes"("scheme_name");

-- CreateIndex
CREATE UNIQUE INDEX "pax_data_data_date_key" ON "public"."pax_data"("data_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_summary_date_meter_id_key" ON "public"."daily_summaries"("summary_date", "meter_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumption_predictions_prediction_date_meter_id_model_vers_key" ON "public"."consumption_predictions"("prediction_date", "meter_id", "model_version");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_sessions" ADD CONSTRAINT "reading_sessions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_sessions" ADD CONSTRAINT "reading_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_sessions" ADD CONSTRAINT "reading_sessions_is_correction_for_id_fkey" FOREIGN KEY ("is_correction_for_id") REFERENCES "public"."reading_sessions"("session_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_types" ADD CONSTRAINT "reading_types_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_details" ADD CONSTRAINT "reading_details_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."reading_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_details" ADD CONSTRAINT "reading_details_reading_type_id_fkey" FOREIGN KEY ("reading_type_id") REFERENCES "public"."reading_types"("reading_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_schemes" ADD CONSTRAINT "price_schemes_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_schemes" ADD CONSTRAINT "price_schemes_set_by_user_id_fkey" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheme_rates" ADD CONSTRAINT "scheme_rates_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."price_schemes"("scheme_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."efficiency_targets" ADD CONSTRAINT "efficiency_targets_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."efficiency_targets" ADD CONSTRAINT "efficiency_targets_set_by_user_id_fkey" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events_logbook" ADD CONSTRAINT "events_logbook_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."efficiency_targets"("target_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_summaries" ADD CONSTRAINT "daily_summaries_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."summary_details" ADD CONSTRAINT "summary_details_summary_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "public"."daily_summaries"("summary_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_insights" ADD CONSTRAINT "analytics_insights_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_insights" ADD CONSTRAINT "analytics_insights_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consumption_predictions" ADD CONSTRAINT "consumption_predictions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;
