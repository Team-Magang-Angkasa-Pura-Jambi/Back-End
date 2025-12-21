-- DropForeignKey
ALTER TABLE "public"."reading_sessions" DROP CONSTRAINT "reading_sessions_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."daily_logbooks" ALTER COLUMN "consumption_change_percent" SET DATA TYPE DECIMAL(15,2);

-- AlterTable
ALTER TABLE "public"."reading_sessions" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."reading_sessions" ADD CONSTRAINT "reading_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
