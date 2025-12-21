-- CreateTable
CREATE TABLE "public"."weather_history" (
    "history_id" SERIAL NOT NULL,
    "data_date" DATE NOT NULL,
    "avg_temp" DECIMAL(5,2) NOT NULL,
    "max_temp" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weather_history_data_date_key" ON "public"."weather_history"("data_date");
