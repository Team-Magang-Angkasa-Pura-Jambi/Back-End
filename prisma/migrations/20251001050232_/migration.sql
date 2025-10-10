/*
  Warnings:

  - Added the required column `reading_unit` to the `reading_types` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."reading_types" ADD COLUMN     "reading_unit" TEXT NOT NULL;
