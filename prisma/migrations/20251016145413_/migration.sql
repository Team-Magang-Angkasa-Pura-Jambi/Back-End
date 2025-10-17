/*
  Warnings:

  - You are about to drop the column `year` on the `annual_budgets` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[energy_type_id,period_start,period_end]` on the table `annual_budgets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `energy_type_id` to the `annual_budgets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period_end` to the `annual_budgets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period_start` to the `annual_budgets` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."annual_budgets_year_key";

-- AlterTable
ALTER TABLE "public"."annual_budgets" DROP COLUMN "year",
ADD COLUMN     "energy_type_id" INTEGER NOT NULL,
ADD COLUMN     "period_end" DATE NOT NULL,
ADD COLUMN     "period_start" DATE NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "annual_budgets_energy_type_id_period_start_period_end_key" ON "public"."annual_budgets"("energy_type_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "public"."annual_budgets" ADD CONSTRAINT "annual_budgets_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;
