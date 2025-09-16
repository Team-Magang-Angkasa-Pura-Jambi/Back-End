/*
  Warnings:

  - The values [UNREAD,ACKNOWLEDGED] on the enum `AlertStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [Aktif,DalamPerbaikan,Nonaktif] on the enum `MeterStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [per_unit,percentage] on the enum `RateType` will be removed. If these variants are still used in the database, this will fail.
  - The values [Teknisi] on the enum `RoleName` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AlertStatus_new" AS ENUM ('NEW', 'READ', 'HANDLED');
ALTER TABLE "public"."ALERTS" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."ALERTS" ALTER COLUMN "status" TYPE "public"."AlertStatus_new" USING ("status"::text::"public"."AlertStatus_new");
ALTER TYPE "public"."AlertStatus" RENAME TO "AlertStatus_old";
ALTER TYPE "public"."AlertStatus_new" RENAME TO "AlertStatus";
DROP TYPE "public"."AlertStatus_old";
ALTER TABLE "public"."ALERTS" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."MeterStatus_new" AS ENUM ('Active', 'UnderMaintenance', 'Inactive');
ALTER TABLE "public"."METERS" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."METERS" ALTER COLUMN "status" TYPE "public"."MeterStatus_new" USING ("status"::text::"public"."MeterStatus_new");
ALTER TYPE "public"."MeterStatus" RENAME TO "MeterStatus_old";
ALTER TYPE "public"."MeterStatus_new" RENAME TO "MeterStatus";
DROP TYPE "public"."MeterStatus_old";
ALTER TABLE "public"."METERS" ALTER COLUMN "status" SET DEFAULT 'Active';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."RateType_new" AS ENUM ('PerUnit', 'Percentage');
ALTER TABLE "public"."SCHEME_RATES" ALTER COLUMN "rate_type" TYPE "public"."RateType_new" USING ("rate_type"::text::"public"."RateType_new");
ALTER TYPE "public"."RateType" RENAME TO "RateType_old";
ALTER TYPE "public"."RateType_new" RENAME TO "RateType";
DROP TYPE "public"."RateType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."RoleName_new" AS ENUM ('Technician', 'Admin', 'SuperAdmin');
ALTER TABLE "public"."ROLES" ALTER COLUMN "role_name" TYPE "public"."RoleName_new" USING ("role_name"::text::"public"."RoleName_new");
ALTER TYPE "public"."RoleName" RENAME TO "RoleName_old";
ALTER TYPE "public"."RoleName_new" RENAME TO "RoleName";
DROP TYPE "public"."RoleName_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."ALERTS" ALTER COLUMN "status" SET DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "public"."METERS" ALTER COLUMN "status" SET DEFAULT 'Active';
