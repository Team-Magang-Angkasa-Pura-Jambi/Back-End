/*
  Warnings:

  - You are about to drop the column `energy_type_id` on the `price_schemes` table. All the data in the column will be lost.
  - You are about to drop the column `rate_name` on the `scheme_rates` table. All the data in the column will be lost.
  - You are about to drop the column `rate_type` on the `scheme_rates` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[effective_date,tariff_group_id]` on the table `price_schemes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[scheme_id,reading_type_id]` on the table `scheme_rates` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tariff_group_id` to the `meters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tariff_group_id` to the `price_schemes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reading_type_id` to the `scheme_rates` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."price_schemes" DROP CONSTRAINT "price_schemes_energy_type_id_fkey";

-- DropIndex
DROP INDEX "public"."daily_usage_classifications_summary_id_idx";

-- DropIndex
DROP INDEX "public"."price_schemes_scheme_name_key";

-- DropIndex
DROP INDEX "public"."summary_details_energy_type_id_idx";

-- DropIndex
DROP INDEX "public"."summary_details_summary_id_idx";

-- AlterTable
ALTER TABLE "public"."meters" ADD COLUMN     "tariff_group_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."price_schemes" DROP COLUMN "energy_type_id",
ADD COLUMN     "tariff_group_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."reading_sessions" ALTER COLUMN "reading_date" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."scheme_rates" DROP COLUMN "rate_name",
DROP COLUMN "rate_type",
ADD COLUMN     "reading_type_id" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "public"."RateType";

-- CreateTable
CREATE TABLE "public"."tariff_groups" (
    "tariff_group_id" SERIAL NOT NULL,
    "group_code" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "tariff_groups_pkey" PRIMARY KEY ("tariff_group_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tariff_groups_group_code_key" ON "public"."tariff_groups"("group_code");

-- CreateIndex
CREATE UNIQUE INDEX "price_schemes_effective_date_tariff_group_id_key" ON "public"."price_schemes"("effective_date", "tariff_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "scheme_rates_scheme_id_reading_type_id_key" ON "public"."scheme_rates"("scheme_id", "reading_type_id");

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_tariff_group_id_fkey" FOREIGN KEY ("tariff_group_id") REFERENCES "public"."tariff_groups"("tariff_group_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_schemes" ADD CONSTRAINT "price_schemes_tariff_group_id_fkey" FOREIGN KEY ("tariff_group_id") REFERENCES "public"."tariff_groups"("tariff_group_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheme_rates" ADD CONSTRAINT "scheme_rates_reading_type_id_fkey" FOREIGN KEY ("reading_type_id") REFERENCES "public"."reading_types"("reading_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;
