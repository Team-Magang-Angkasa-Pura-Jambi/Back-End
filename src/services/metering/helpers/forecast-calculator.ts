import prisma from '../../../configs/db.js';
import { type Prisma, UsageCategory } from '../../../generated/prisma/index.js';

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

export const _saveClassification = async (
  summary: Prisma.DailySummaryGetPayload<object>,
  kinerja: string,
  deviasi: number,
  modelVersion: string,
) => {
  const classification = _mapClassificationToEnum(kinerja);
  const reasoning = `Deviasi ${deviasi.toFixed(2)}% dari prediksi normal.`;

  return await prisma.dailyUsageClassification.upsert({
    where: { summary_id: summary.summary_id },
    update: {
      classification,
      confidence_score: deviasi,
      model_version: modelVersion,
      reasoning,
    },
    create: {
      summary_id: summary.summary_id,
      meter_id: summary.meter_id,
      classification_date: summary.summary_date,
      classification,
      confidence_score: deviasi,
      model_version: modelVersion,
      reasoning,
    },
  });
};
