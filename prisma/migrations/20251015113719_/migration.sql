-- CreateTable
CREATE TABLE "public"."annual_budgets" (
    "budget_id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "total_budget" DECIMAL(20,2) NOT NULL,
    "efficiency_tag" DECIMAL(5,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_budgets_pkey" PRIMARY KEY ("budget_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annual_budgets_year_key" ON "public"."annual_budgets"("year");
