/*
  Warnings:

  - The `status` column on the `meters` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `shape` on the `tank_profiles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."MeterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."TankShape" AS ENUM ('CYLINDER_VERTICAL', 'CYLINDER_HORIZONTAL', 'BOX');

-- DropForeignKey
ALTER TABLE "public"."meter_reading_configs" DROP CONSTRAINT "meter_reading_configs_meter_id_fkey";

-- AlterTable
ALTER TABLE "public"."meters" DROP COLUMN "status",
ADD COLUMN     "status" "public"."MeterStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "public"."tank_profiles" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" INTEGER,
DROP COLUMN "shape",
ADD COLUMN     "shape" "public"."TankShape" NOT NULL;

-- CreateIndex
CREATE INDEX "meters_tenant_id_idx" ON "public"."meters"("tenant_id");

-- CreateIndex
CREATE INDEX "meters_location_id_idx" ON "public"."meters"("location_id");

-- CreateIndex
CREATE INDEX "meters_status_idx" ON "public"."meters"("status");

-- AddForeignKey
ALTER TABLE "public"."meter_reading_configs" ADD CONSTRAINT "meter_reading_configs_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tank_profiles" ADD CONSTRAINT "tank_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
