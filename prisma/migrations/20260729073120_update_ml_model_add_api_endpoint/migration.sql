/*
  Warnings:

  - The primary key for the `ml_classifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `accuracy_score` on the `ml_models` table. All the data in the column will be lost.
  - You are about to drop the column `last_trained` on the `ml_models` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `ml_models` table. All the data in the column will be lost.
  - The primary key for the `ml_predictions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `api_endpoint` to the `ml_models` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."meters" ADD COLUMN     "mlModelModel_id" TEXT;

-- AlterTable
ALTER TABLE "public"."ml_classifications" DROP CONSTRAINT "ml_classifications_pkey",
ALTER COLUMN "classification_id" DROP DEFAULT,
ALTER COLUMN "classification_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ml_classifications_pkey" PRIMARY KEY ("classification_id");
DROP SEQUENCE "ml_classifications_classification_id_seq";

-- AlterTable
ALTER TABLE "public"."ml_models" DROP COLUMN "accuracy_score",
DROP COLUMN "last_trained",
DROP COLUMN "type",
ADD COLUMN     "api_endpoint" TEXT NOT NULL,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "version" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."ml_predictions" DROP CONSTRAINT "ml_predictions_pkey",
ALTER COLUMN "prediction_id" DROP DEFAULT,
ALTER COLUMN "prediction_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ml_predictions_pkey" PRIMARY KEY ("prediction_id");
DROP SEQUENCE "ml_predictions_prediction_id_seq";

-- AddForeignKey
ALTER TABLE "public"."meters" ADD CONSTRAINT "meters_mlModelModel_id_fkey" FOREIGN KEY ("mlModelModel_id") REFERENCES "public"."ml_models"("model_id") ON DELETE SET NULL ON UPDATE CASCADE;
