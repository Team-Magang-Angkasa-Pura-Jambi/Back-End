/*
  Warnings:

  - Added the required column `updatedAt` to the `USERS` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."USERS" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "role_id" DROP DEFAULT;
