/*
  Warnings:

  - Changed the type of `role_name` on the `roles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."RoleType" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'TECHNICIAN');

-- AlterTable
ALTER TABLE "public"."roles" DROP COLUMN "role_name",
ADD COLUMN     "role_name" "public"."RoleType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "public"."roles"("role_name");
