-- CreateTable
CREATE TABLE "public"."roles" (
    "role_id" SERIAL NOT NULL,
    "role_name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "user_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "full_name" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "image_url" TEXT,
    "role_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."energy_types" (
    "energy_type_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit_standard" TEXT NOT NULL,

    CONSTRAINT "energy_types_pkey" PRIMARY KEY ("energy_type_id")
);

-- CreateTable
CREATE TABLE "public"."reading_types" (
    "reading_type_id" SERIAL NOT NULL,
    "energy_type_id" INTEGER NOT NULL,
    "type_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "reading_types_pkey" PRIMARY KEY ("reading_type_id")
);

-- CreateTable
CREATE TABLE "public"."meters" (
    "meter_id" SERIAL NOT NULL,
    "meter_code" TEXT NOT NULL,
    "serial_number" TEXT,
    "name" TEXT,
    "tenant_id" INTEGER,
    "location_id" INTEGER,
    "calculation_template_id" TEXT,
    "price_scheme_id" INTEGER,
    "energy_type_id" INTEGER NOT NULL,
    "multiplier" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    "initial_reading" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "meters_pkey" PRIMARY KEY ("meter_id")
);

-- CreateTable
CREATE TABLE "public"."meter_reading_configs" (
    "config_id" SERIAL NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "reading_type_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "alarm_min_threshold" DECIMAL(10,2),
    "alarm_max_threshold" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "meter_reading_configs_pkey" PRIMARY KEY ("config_id")
);

-- CreateTable
CREATE TABLE "public"."tank_profiles" (
    "profile_id" SERIAL NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "shape" TEXT NOT NULL,
    "height_max_cm" DECIMAL(10,2) NOT NULL,
    "length_cm" DECIMAL(10,2),
    "width_cm" DECIMAL(10,2),
    "diameter_cm" DECIMAL(10,2),
    "capacity_liters" DECIMAL(12,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "tank_profiles_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "public"."calculation_templates" (
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "calculation_templates_pkey" PRIMARY KEY ("template_id")
);

-- CreateTable
CREATE TABLE "public"."formula_definitions" (
    "def_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "formula_items" JSONB NOT NULL,

    CONSTRAINT "formula_definitions_pkey" PRIMARY KEY ("def_id")
);

-- CreateTable
CREATE TABLE "public"."reading_sessions" (
    "session_id" SERIAL NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "reading_date" TIMESTAMP(3) NOT NULL,
    "captured_by_user_id" INTEGER,
    "evidence_image_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "public"."reading_details" (
    "detail_id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "reading_type_id" INTEGER NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "reading_details_pkey" PRIMARY KEY ("detail_id")
);

-- CreateTable
CREATE TABLE "public"."price_schemes" (
    "scheme_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effective_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "price_schemes_pkey" PRIMARY KEY ("scheme_id")
);

-- CreateTable
CREATE TABLE "public"."scheme_rates" (
    "rate_id" SERIAL NOT NULL,
    "scheme_id" INTEGER NOT NULL,
    "reading_type_id" INTEGER NOT NULL,
    "rate_value" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "scheme_rates_pkey" PRIMARY KEY ("rate_id")
);

-- CreateTable
CREATE TABLE "public"."daily_summaries" (
    "summary_id" SERIAL NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "summary_date" DATE NOT NULL,
    "total_usage" DECIMAL(19,4) NOT NULL,
    "total_cost" DECIMAL(19,4) NOT NULL,
    "used_formula_template_id" TEXT,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("summary_id")
);

-- CreateTable
CREATE TABLE "public"."summary_details" (
    "id" SERIAL NOT NULL,
    "summary_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "summary_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "notification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "reference_table" TEXT,
    "reference_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "public"."tenants" (
    "tenant_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "location_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "public"."meter_lifecycle_logs" (
    "log_id" SERIAL NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "event_type" TEXT NOT NULL,
    "old_serial_num" TEXT,
    "new_serial_num" TEXT,
    "last_reading" DECIMAL(19,4),
    "initial_reading" DECIMAL(19,4),
    "evidence_image_url" TEXT,
    "technician_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "meter_lifecycle_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "log_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity_table" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "public"."annual_budgets" (
    "budget_id" SERIAL NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "energy_type_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "total_volume" DECIMAL(19,4) NOT NULL,
    "efficiency_target_percentage" DECIMAL(5,4),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "annual_budgets_pkey" PRIMARY KEY ("budget_id")
);

-- CreateTable
CREATE TABLE "public"."budget_allocations" (
    "allocation_id" SERIAL NOT NULL,
    "budget_id" INTEGER NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "allocated_amount" DECIMAL(19,4) NOT NULL,
    "allocated_volume" DECIMAL(19,4) NOT NULL,
    "monthly_distribution_profile" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("allocation_id")
);

-- CreateTable
CREATE TABLE "public"."efficiency_targets" (
    "target_id" SERIAL NOT NULL,
    "meter_id" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "kpi_name" TEXT NOT NULL,
    "target_percentage" DECIMAL(5,4) NOT NULL,
    "baseline_value" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "efficiency_targets_pkey" PRIMARY KEY ("target_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "public"."roles"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "energy_types_name_key" ON "public"."energy_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "reading_types_type_name_energy_type_id_key" ON "public"."reading_types"("type_name", "energy_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "meters_meter_code_key" ON "public"."meters"("meter_code");

-- CreateIndex
CREATE UNIQUE INDEX "meter_reading_configs_meter_id_reading_type_id_key" ON "public"."meter_reading_configs"("meter_id", "reading_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "tank_profiles_meter_id_key" ON "public"."tank_profiles"("meter_id");

-- CreateIndex
CREATE UNIQUE INDEX "reading_sessions_meter_id_reading_date_key" ON "public"."reading_sessions"("meter_id", "reading_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_meter_id_summary_date_key" ON "public"."daily_summaries"("meter_id", "summary_date");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_types" ADD CONSTRAINT "reading_types_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_calculation_template_id_fkey" FOREIGN KEY ("calculation_template_id") REFERENCES "public"."calculation_templates"("template_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_price_scheme_id_fkey" FOREIGN KEY ("price_scheme_id") REFERENCES "public"."price_schemes"("scheme_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_reading_configs" ADD CONSTRAINT "meter_reading_configs_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_reading_configs" ADD CONSTRAINT "meter_reading_configs_reading_type_id_fkey" FOREIGN KEY ("reading_type_id") REFERENCES "public"."reading_types"("reading_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_reading_configs" ADD CONSTRAINT "meter_reading_configs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_reading_configs" ADD CONSTRAINT "meter_reading_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tank_profiles" ADD CONSTRAINT "tank_profiles_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tank_profiles" ADD CONSTRAINT "tank_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calculation_templates" ADD CONSTRAINT "calculation_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calculation_templates" ADD CONSTRAINT "calculation_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."formula_definitions" ADD CONSTRAINT "formula_definitions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."calculation_templates"("template_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_sessions" ADD CONSTRAINT "reading_sessions_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_sessions" ADD CONSTRAINT "reading_sessions_captured_by_user_id_fkey" FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_details" ADD CONSTRAINT "reading_details_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."reading_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reading_details" ADD CONSTRAINT "reading_details_reading_type_id_fkey" FOREIGN KEY ("reading_type_id") REFERENCES "public"."reading_types"("reading_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_schemes" ADD CONSTRAINT "price_schemes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_schemes" ADD CONSTRAINT "price_schemes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheme_rates" ADD CONSTRAINT "scheme_rates_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."price_schemes"("scheme_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheme_rates" ADD CONSTRAINT "scheme_rates_reading_type_id_fkey" FOREIGN KEY ("reading_type_id") REFERENCES "public"."reading_types"("reading_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_summaries" ADD CONSTRAINT "daily_summaries_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."summary_details" ADD CONSTRAINT "summary_details_summary_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "public"."daily_summaries"("summary_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenants" ADD CONSTRAINT "tenants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenants" ADD CONSTRAINT "tenants_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_lifecycle_logs" ADD CONSTRAINT "meter_lifecycle_logs_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_lifecycle_logs" ADD CONSTRAINT "meter_lifecycle_logs_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meter_lifecycle_logs" ADD CONSTRAINT "meter_lifecycle_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."annual_budgets" ADD CONSTRAINT "annual_budgets_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."annual_budgets" ADD CONSTRAINT "annual_budgets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."annual_budgets" ADD CONSTRAINT "annual_budgets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."budget_allocations" ADD CONSTRAINT "budget_allocations_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."annual_budgets"("budget_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."budget_allocations" ADD CONSTRAINT "budget_allocations_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."efficiency_targets" ADD CONSTRAINT "efficiency_targets_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("meter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."efficiency_targets" ADD CONSTRAINT "efficiency_targets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
