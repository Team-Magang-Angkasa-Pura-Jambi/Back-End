-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TankShape" ADD VALUE 'SPHERE';
ALTER TYPE "public"."TankShape" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "public"."tank_profiles" ALTER COLUMN "shape" DROP NOT NULL;
