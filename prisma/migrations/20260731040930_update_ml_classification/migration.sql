/*
  Warnings:

  - You are about to drop the column `confidence_score` on the `ml_classifications` table. All the data in the column will be lost.
  - You are about to drop the column `is_verified` on the `ml_classifications` table. All the data in the column will be lost.
  - You are about to drop the column `model_id` on the `ml_classifications` table. All the data in the column will be lost.
  - You are about to drop the column `reading_session_id` on the `ml_classifications` table. All the data in the column will be lost.
  - Added the required column `model_used` to the `ml_classifications` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."ml_classifications" DROP CONSTRAINT "ml_classifications_reading_session_id_fkey";

-- DropIndex
DROP INDEX "public"."ml_classifications_reading_session_id_key";

-- AlterTable
ALTER TABLE "public"."ml_classifications" DROP COLUMN "confidence_score",
DROP COLUMN "is_verified",
DROP COLUMN "model_id",
DROP COLUMN "reading_session_id",
ADD COLUMN     "model_used" TEXT NOT NULL;
