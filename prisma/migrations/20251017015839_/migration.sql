-- AlterTable
ALTER TABLE "public"."annual_budgets" ADD COLUMN     "parent_budget_id" INTEGER;

-- CreateIndex
CREATE INDEX "annual_budgets_parent_budget_id_idx" ON "public"."annual_budgets"("parent_budget_id");

-- AddForeignKey
ALTER TABLE "public"."annual_budgets" ADD CONSTRAINT "annual_budgets_parent_budget_id_fkey" FOREIGN KEY ("parent_budget_id") REFERENCES "public"."annual_budgets"("budget_id") ON DELETE SET NULL ON UPDATE CASCADE;
