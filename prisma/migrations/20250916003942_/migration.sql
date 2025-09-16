/*
  Warnings:

  - You are about to drop the column `notes` on the `ALERTS` table. All the data in the column will be lost.
  - You are about to drop the column `location_group` on the `EFFICIENCY_TARGETS` table. All the data in the column will be lost.
  - You are about to drop the column `location_group` on the `EVENTS_LOGBOOK` table. All the data in the column will be lost.
  - You are about to drop the column `decommission_date` on the `METERS` table. All the data in the column will be lost.
  - You are about to drop the column `installation_date` on the `METERS` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `METERS` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `METERS` table. All the data in the column will be lost.
  - You are about to drop the column `profile_id` on the `METERS` table. All the data in the column will be lost.
  - The `status` column on the `METERS` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `location_group` on the `PAX_DATA` table. All the data in the column will be lost.
  - You are about to drop the `CONSUMPTION_PROFILES` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PRICE_TIERS` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PROFILE_HOURLY_WEIGHTS` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `READINGS` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."MeterStatus" AS ENUM ('Aktif', 'DalamPerbaikan', 'Nonaktif');

-- CreateEnum
CREATE TYPE "public"."RateType" AS ENUM ('per_unit', 'percentage');

-- DropForeignKey
ALTER TABLE "public"."METERS" DROP CONSTRAINT "METERS_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."PRICE_TIERS" DROP CONSTRAINT "PRICE_TIERS_scheme_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."PROFILE_HOURLY_WEIGHTS" DROP CONSTRAINT "PROFILE_HOURLY_WEIGHTS_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."READINGS" DROP CONSTRAINT "READINGS_is_correction_for_fkey";

-- DropForeignKey
ALTER TABLE "public"."READINGS" DROP CONSTRAINT "READINGS_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."READINGS" DROP CONSTRAINT "READINGS_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."ALERTS" DROP COLUMN "notes";

-- AlterTable
ALTER TABLE "public"."EFFICIENCY_TARGETS" DROP COLUMN "location_group";

-- AlterTable
ALTER TABLE "public"."EVENTS_LOGBOOK" DROP COLUMN "location_group";

-- AlterTable
ALTER TABLE "public"."METERS" DROP COLUMN "decommission_date",
DROP COLUMN "installation_date",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "profile_id",
DROP COLUMN "status",
ADD COLUMN     "status" "public"."MeterStatus" NOT NULL DEFAULT 'Aktif';

-- AlterTable
ALTER TABLE "public"."PAX_DATA" DROP COLUMN "location_group";

-- DropTable
DROP TABLE "public"."CONSUMPTION_PROFILES";

-- DropTable
DROP TABLE "public"."PRICE_TIERS";

-- DropTable
DROP TABLE "public"."PROFILE_HOURLY_WEIGHTS";

-- DropTable
DROP TABLE "public"."READINGS";

-- DropEnum
DROP TYPE "public"."ReadingType";

-- DropEnum
DROP TYPE "public"."meter_status_enum";

-- CreateTable
CREATE TABLE "public"."READING_SESSIONS" (
    "session_id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_correction_for_id" INTEGER,

    CONSTRAINT "READING_SESSIONS_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "public"."READING_TYPES" (
    "reading_type_id" SERIAL NOT NULL,
    "type_name" TEXT NOT NULL,
    "energy_type_id" INTEGER NOT NULL,

    CONSTRAINT "READING_TYPES_pkey" PRIMARY KEY ("reading_type_id")
);

-- CreateTable
CREATE TABLE "public"."READING_DETAILS" (
    "detail_id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "reading_type_id" INTEGER NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "READING_DETAILS_pkey" PRIMARY KEY ("detail_id")
);

-- CreateTable
CREATE TABLE "public"."SCHEME_RATES" (
    "rate_id" SERIAL NOT NULL,
    "rate_name" TEXT NOT NULL,
    "rate_type" "public"."RateType" NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "scheme_id" INTEGER NOT NULL,

    CONSTRAINT "SCHEME_RATES_pkey" PRIMARY KEY ("rate_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "READING_SESSIONS_is_correction_for_id_key" ON "public"."READING_SESSIONS"("is_correction_for_id");

-- CreateIndex
CREATE UNIQUE INDEX "READING_TYPES_type_name_key" ON "public"."READING_TYPES"("type_name");

-- AddForeignKey
ALTER TABLE "public"."READING_SESSIONS" ADD CONSTRAINT "READING_SESSIONS_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USERS"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."READING_SESSIONS" ADD CONSTRAINT "READING_SESSIONS_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."METERS"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."READING_SESSIONS" ADD CONSTRAINT "READING_SESSIONS_is_correction_for_id_fkey" FOREIGN KEY ("is_correction_for_id") REFERENCES "public"."READING_SESSIONS"("session_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."READING_TYPES" ADD CONSTRAINT "READING_TYPES_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."ENERGY_TYPES"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."READING_DETAILS" ADD CONSTRAINT "READING_DETAILS_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."READING_SESSIONS"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."READING_DETAILS" ADD CONSTRAINT "READING_DETAILS_reading_type_id_fkey" FOREIGN KEY ("reading_type_id") REFERENCES "public"."READING_TYPES"("reading_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SCHEME_RATES" ADD CONSTRAINT "SCHEME_RATES_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."PRICE_SCHEMES"("scheme_id") ON DELETE RESTRICT ON UPDATE CASCADE;
