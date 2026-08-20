-- DropForeignKey
ALTER TABLE "public"."reading_types" DROP CONSTRAINT "reading_types_energy_type_id_fkey";

-- CreateIndex
CREATE INDEX "reading_sessions_reading_date_idx" ON "public"."reading_sessions"("reading_date");

-- AddForeignKey
ALTER TABLE "public"."reading_types" ADD CONSTRAINT "reading_types_energy_type_id_fkey" FOREIGN KEY ("energy_type_id") REFERENCES "public"."energy_types"("energy_type_id") ON DELETE CASCADE ON UPDATE CASCADE;
