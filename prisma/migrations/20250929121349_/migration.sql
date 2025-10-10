/*
  Warnings:

  - A unique constraint covering the columns `[session_id,reading_type_id]` on the table `reading_details` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "reading_details_session_id_reading_type_id_key" ON "public"."reading_details"("session_id", "reading_type_id");
