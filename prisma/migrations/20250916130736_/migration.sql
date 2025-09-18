-- AlterEnum
ALTER TYPE "public"."MeterStatus" ADD VALUE 'DELETED';

-- DropForeignKey
ALTER TABLE "public"."READING_DETAILS" DROP CONSTRAINT "READING_DETAILS_session_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."SCHEME_RATES" DROP CONSTRAINT "SCHEME_RATES_scheme_id_fkey";

-- AlterTable
ALTER TABLE "public"."ENERGY_TYPES" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."USERS" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "public"."READING_DETAILS" ADD CONSTRAINT "READING_DETAILS_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."READING_SESSIONS"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SCHEME_RATES" ADD CONSTRAINT "SCHEME_RATES_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."PRICE_SCHEMES"("scheme_id") ON DELETE CASCADE ON UPDATE CASCADE;
