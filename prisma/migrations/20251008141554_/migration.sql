-- AlterTable
ALTER TABLE "public"."tariff_groups" ADD COLUMN     "daya_va" INTEGER,
ADD COLUMN     "faktor_kali" INTEGER NOT NULL DEFAULT 2;
