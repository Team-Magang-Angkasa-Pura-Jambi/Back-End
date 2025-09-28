/*
  Warnings:

  - You are about to drop the column `location` on the `meters` table. All the data in the column will be lost.
  - You are about to drop the column `is_correction_for_id` on the `reading_sessions` table. All the data in the column will be lost.
  - Added the required column `category_id` to the `meters` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."reading_sessions" DROP CONSTRAINT "reading_sessions_is_correction_for_id_fkey";

-- DropIndex
DROP INDEX "public"."reading_sessions_is_correction_for_id_key";

-- AlterTable
ALTER TABLE "public"."meters" DROP COLUMN "location",
ADD COLUMN     "category_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."reading_sessions" DROP COLUMN "is_correction_for_id";

-- CreateTable
CREATE TABLE "public"."meter_categories" (
    "category_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "meter_categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "public"."_CategoryToReadingTypes" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CategoryToReadingTypes_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "meter_categories_name_key" ON "public"."meter_categories"("name");

-- CreateIndex
CREATE INDEX "_CategoryToReadingTypes_B_index" ON "public"."_CategoryToReadingTypes"("B");

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."meter_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToReadingTypes" ADD CONSTRAINT "_CategoryToReadingTypes_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."meter_categories"("category_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToReadingTypes" ADD CONSTRAINT "_CategoryToReadingTypes_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."reading_types"("reading_type_id") ON DELETE CASCADE ON UPDATE CASCADE;
