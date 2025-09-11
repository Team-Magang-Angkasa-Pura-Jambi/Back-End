-- CreateEnum
CREATE TYPE "public"."RoleName" AS ENUM ('Teknisi', 'Admin', 'SuperAdmin');

-- CreateEnum
CREATE TYPE "public"."meter_status_enum" AS ENUM ('Aktif', 'DalamPerbaikan', 'Rusak', 'Diganti');

-- CreateEnum
CREATE TYPE "public"."ReadingType" AS ENUM ('cumulative', 'delta');

-- CreateEnum
CREATE TYPE "public"."AlertStatus" AS ENUM ('UNREAD', 'READ', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "public"."USERS" (
    "user_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "USERS_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."ROLES" (
    "role_id" SERIAL NOT NULL,
    "role_name" "public"."RoleName" NOT NULL,

    CONSTRAINT "ROLES_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "public"."ENERGY_TYPES" (
    "energy_type_id" SERIAL NOT NULL,
    "type_name" TEXT NOT NULL,
    "unit_of_measurement" TEXT NOT NULL,

    CONSTRAINT "ENERGY_TYPES_pkey" PRIMARY KEY ("energy_type_id")
);

-- CreateTable
CREATE TABLE "public"."CONSUMPTION_PROFILES" (
    "profile_id" SERIAL NOT NULL,
    "profile_name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "CONSUMPTION_PROFILES_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "public"."PROFILE_HOURLY_WEIGHTS" (
    "weight_id" SERIAL NOT NULL,
    "hour_of_day" INTEGER NOT NULL,
    "weight_factor" DECIMAL(5,4) NOT NULL,
    "profile_id" INTEGER NOT NULL,

    CONSTRAINT "PROFILE_HOURLY_WEIGHTS_pkey" PRIMARY KEY ("weight_id")
);

-- CreateTable
CREATE TABLE "public"."METERS" (
    "meter_id" SERIAL NOT NULL,
    "meter_code" TEXT NOT NULL,
    "location" TEXT,
    "status" "public"."meter_status_enum" NOT NULL DEFAULT 'Aktif',
    "installation_date" DATE,
    "decommission_date" DATE,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "energy_type_id" INTEGER NOT NULL,
    "profile_id" INTEGER,

    CONSTRAINT "METERS_pkey" PRIMARY KEY ("meter_id")
);

-- CreateTable
CREATE TABLE "public"."READINGS" (
    "reading_id" SERIAL NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "reading_type" "public"."ReadingType" NOT NULL DEFAULT 'cumulative',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "is_estimated" BOOLEAN NOT NULL DEFAULT false,
    "photo_proof_url" TEXT,
    "notes" TEXT,
    "meter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_correction_for" INTEGER,

    CONSTRAINT "READINGS_pkey" PRIMARY KEY ("reading_id")
);

-- CreateTable
CREATE TABLE "public"."PAX_DATA" (
    "pax_id" SERIAL NOT NULL,
    "data_date" DATE NOT NULL,
    "total_pax" INTEGER NOT NULL,
    "location_group" TEXT,

    CONSTRAINT "PAX_DATA_pkey" PRIMARY KEY ("pax_id")
);

-- CreateTable
CREATE TABLE "public"."EVENTS_LOGBOOK" (
    "event_id" SERIAL NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "location_group" TEXT,
    "notes" TEXT NOT NULL,
    "reported_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "EVENTS_LOGBOOK_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "public"."PRICE_SCHEMES" (
    "scheme_id" SERIAL NOT NULL,
    "scheme_name" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "energy_type_id" INTEGER NOT NULL,
    "set_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "PRICE_SCHEMES_pkey" PRIMARY KEY ("scheme_id")
);

-- CreateTable
CREATE TABLE "public"."PRICE_TIERS" (
    "tier_id" SERIAL NOT NULL,
    "tier_name" TEXT,
    "min_usage" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "max_usage" DECIMAL(10,2),
    "price_value" DECIMAL(12,2) NOT NULL,
    "scheme_id" INTEGER NOT NULL,

    CONSTRAINT "PRICE_TIERS_pkey" PRIMARY KEY ("tier_id")
);

-- CreateTable
CREATE TABLE "public"."EFFICIENCY_TARGETS" (
    "target_id" SERIAL NOT NULL,
    "location_group" TEXT,
    "kpi_name" TEXT NOT NULL,
    "target_value" DECIMAL(10,2) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "energy_type_id" INTEGER NOT NULL,
    "set_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "EFFICIENCY_TARGETS_pkey" PRIMARY KEY ("target_id")
);

-- CreateTable
CREATE TABLE "public"."ALERTS" (
    "alert_id" SERIAL NOT NULL,
    "alert_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actual_value" DECIMAL(12,2) NOT NULL,
    "target_value_at_trigger" DECIMAL(12,2) NOT NULL,
    "status" "public"."AlertStatus" NOT NULL DEFAULT 'UNREAD',
    "notes" TEXT,
    "target_id" INTEGER NOT NULL,
    "acknowledged_by_user_id" INTEGER,

    CONSTRAINT "ALERTS_pkey" PRIMARY KEY ("alert_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "USERS_username_key" ON "public"."USERS"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ROLES_role_name_key" ON "public"."ROLES"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "ENERGY_TYPES_type_name_key" ON "public"."ENERGY_TYPES"("type_name");

-- CreateIndex
CREATE UNIQUE INDEX "CONSUMPTION_PROFILES_profile_name_key" ON "public"."CONSUMPTION_PROFILES"("profile_name");

-- CreateIndex
CREATE UNIQUE INDEX "METERS_meter_code_key" ON "public"."METERS"("meter_code");

-- CreateIndex
CREATE UNIQUE INDEX "READINGS_is_correction_for_key" ON "public"."READINGS"("is_correction_for");

-- CreateIndex
CREATE UNIQUE INDEX "PAX_DATA_data_date_key" ON "public"."PAX_DATA"("data_date");

-- CreateIndex
CREATE UNIQUE INDEX "PRICE_SCHEMES_scheme_name_key" ON "public"."PRICE_SCHEMES"("scheme_name");

-- AddForeignKey
ALTER TABLE "public"."USERS" ADD CONSTRAINT "USERS_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."ROLES"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PROFILE_HOURLY_WEIGHTS" ADD CONSTRAINT "PROFILE_HOURLY_WEIGHTS_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."CONSUMPTION_PROFILES"("profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."METERS" ADD CONSTRAINT "METERS_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."ENERGY_TYPES"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."METERS" ADD CONSTRAINT "METERS_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."CONSUMPTION_PROFILES"("profile_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."READINGS" ADD CONSTRAINT "READINGS_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."METERS"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."READINGS" ADD CONSTRAINT "READINGS_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USERS"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."READINGS" ADD CONSTRAINT "READINGS_is_correction_for_fkey" FOREIGN KEY ("is_correction_for") REFERENCES "public"."READINGS"("reading_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EVENTS_LOGBOOK" ADD CONSTRAINT "EVENTS_LOGBOOK_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."USERS"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRICE_SCHEMES" ADD CONSTRAINT "PRICE_SCHEMES_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."ENERGY_TYPES"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRICE_SCHEMES" ADD CONSTRAINT "PRICE_SCHEMES_set_by_user_id_fkey" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."USERS"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRICE_TIERS" ADD CONSTRAINT "PRICE_TIERS_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."PRICE_SCHEMES"("scheme_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EFFICIENCY_TARGETS" ADD CONSTRAINT "EFFICIENCY_TARGETS_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."ENERGY_TYPES"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EFFICIENCY_TARGETS" ADD CONSTRAINT "EFFICIENCY_TARGETS_set_by_user_id_fkey" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."USERS"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ALERTS" ADD CONSTRAINT "ALERTS_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."EFFICIENCY_TARGETS"("target_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ALERTS" ADD CONSTRAINT "ALERTS_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."USERS"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
