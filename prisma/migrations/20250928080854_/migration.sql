/*
  Warnings:

  - The values [DELETED] on the enum `MeterStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `total_pax` on the `daily_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `reading_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `reading_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."MeterStatus_new" AS ENUM ('Active', 'UnderMaintenance', 'Inactive', 'Deleted');
ALTER TABLE "public"."meters" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."meters" ALTER COLUMN "status" TYPE "public"."MeterStatus_new" USING ("status"::text::"public"."MeterStatus_new");
ALTER TYPE "public"."MeterStatus" RENAME TO "MeterStatus_old";
ALTER TYPE "public"."MeterStatus_new" RENAME TO "MeterStatus";
DROP TYPE "public"."MeterStatus_old";
ALTER TABLE "public"."meters" ALTER COLUMN "status" SET DEFAULT 'Active';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."reading_sessions" DROP CONSTRAINT "reading_sessions_meter_id_fkey";

-- AlterTable
ALTER TABLE "public"."daily_summaries" DROP COLUMN "total_pax";

-- AlterTable
ALTER TABLE "public"."events_logbook" ALTER COLUMN "event_timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."reading_sessions" DROP COLUMN "updatedAt",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "updatedAt",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."taxes" (
    "tax_id" SERIAL NOT NULL,
    "tax_name" TEXT NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "taxes_pkey" PRIMARY KEY ("tax_id")
);

-- CreateTable
CREATE TABLE "public"."price_schemes_on_taxes" (
    "scheme_id" INTEGER NOT NULL,
    "tax_id" INTEGER NOT NULL,

    CONSTRAINT "price_schemes_on_taxes_pkey" PRIMARY KEY ("scheme_id","tax_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "taxes_tax_name_key" ON "public"."taxes"("tax_name");

-- AddForeignKey
ALTER TABLE "public"."reading_sessions" ADD CONSTRAINT "reading_sessions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_schemes_on_taxes" ADD CONSTRAINT "price_schemes_on_taxes_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."price_schemes"("scheme_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_schemes_on_taxes" ADD CONSTRAINT "price_schemes_on_taxes_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("tax_id") ON DELETE CASCADE ON UPDATE CASCADE;
