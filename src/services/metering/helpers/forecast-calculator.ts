import prisma from '../../../configs/db.js';
import { UsageCategory } from '../../../generated/prisma/index.js';

/**
 * Memetakan hasil string dari model ML ke tipe enum UsageCategory.
 */
export const _mapClassificationToEnum = (classification: string): UsageCategory => {
  const upperCaseClassification = classification.toUpperCase();
  if (upperCaseClassification.includes('HEMAT')) {
    return UsageCategory.HEMAT;
  }
  if (upperCaseClassification.includes('BOROS') || upperCaseClassification.includes('PEMBOROSAN')) {
    return UsageCategory.BOROS;
  }
  return UsageCategory.NORMAL;
};

// Di dalam file forecast-calculator.ts

export const _saveClassification = async (
  validKwh: any,
  kinerja: string,
  deviasi: number,
  modelVersion: string,
  date: Date, // Tambahkan parameter ini
) => {
  const classification = _mapClassificationToEnum(kinerja);
  const reasoning = `Deviasi ${deviasi.toFixed(2)}% dari prediksi normal.`;

  return await prisma.dailyUsageClassification.upsert({
    where: {
      summary_id: validKwh.summary_id,
    },
    update: {
      classification: classification,
      confidence_score: deviasi,
      model_version: modelVersion,
      reasoning: reasoning,
      // classification_date biasanya tidak diupdate jika sudah ada
    },
    create: {
      summary_id: validKwh.summary_id,
      meter_id: validKwh.meter_id,
      classification: classification,
      confidence_score: deviasi,
      model_version: modelVersion,
      reasoning: reasoning,
      classification_date: date, // SELESAI: Ini yang menyebabkan error tadi
    },
  });
};
