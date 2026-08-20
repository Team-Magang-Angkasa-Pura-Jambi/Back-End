/*
  Warnings:

  - You are about to drop the column `total_volume` on the `annual_budgets` table. All the data in the column will be lost.
  - You are about to drop the `budget_allocations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."budget_allocations" DROP CONSTRAINT "budget_allocations_budget_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."budget_allocations" DROP CONSTRAINT "budget_allocations_meter_id_fkey";

-- AlterTable
ALTER TABLE "public"."annual_budgets" DROP COLUMN "total_volume";

-- DropTable
DROP TABLE "public"."budget_allocations";
