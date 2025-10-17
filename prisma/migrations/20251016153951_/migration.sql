-- DropIndex
DROP INDEX "public"."annual_budgets_energy_type_id_period_start_period_end_key";

-- CreateTable
CREATE TABLE "public"."budget_allocations" (
    "allocation_id" SERIAL NOT NULL,
    "weight" DECIMAL(5,4) NOT NULL,
    "budget_id" INTEGER NOT NULL,
    "meter_id" INTEGER NOT NULL,

    CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("allocation_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_allocations_budget_id_meter_id_key" ON "public"."budget_allocations"("budget_id", "meter_id");

-- AddForeignKey
ALTER TABLE "public"."budget_allocations" ADD CONSTRAINT "budget_allocations_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."annual_budgets"("budget_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."budget_allocations" ADD CONSTRAINT "budget_allocations_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;
