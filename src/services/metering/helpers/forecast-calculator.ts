import prisma from '../../../configs/db.js';
import { type Prisma, UsageCategory } from '../../../generated/prisma/index.js';
import { type MeterWithRelations } from '../../../types/metering/meter.types-temp.js';
import { machineLearningService } from '../../intelligence/machineLearning.service.js';

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

export const _classifyDailyUsage = async (
  summary: Prisma.DailySummaryGetPayload<object>,
  meter: MeterWithRelations,
) => {
  if (meter.energy_type.type_name !== 'Electricity') {
    console.log(
      `[Classifier] Klasifikasi dilewati untuk tipe energi: ${meter.energy_type.type_name}`,
    );
    return;
  }

  const classificationDate = summary.summary_date;

  const [paxData, weatherData, kantorSummary, terminalSummary] = await Promise.all([
    prisma.paxData.findUnique({
      where: { data_date: classificationDate },
    }),
    prisma.weatherHistory.findUnique({
      where: { data_date: classificationDate },
    }),
    prisma.dailySummary.findFirst({
      where: {
        summary_date: classificationDate,
        meter: { meter_code: 'ELEC-KANTOR-01' },
      },
    }),
    prisma.dailySummary.findFirst({
      where: {
        summary_date: classificationDate,
        meter: { meter_code: 'ELEC-TERM-01' },
      },
    }),
  ]);

  // 2. Validasi kelengkapan data
  if (!paxData || !weatherData || !kantorSummary || !terminalSummary) {
    const missing = [];
    if (!paxData) missing.push('Data Pax');
    if (!weatherData) missing.push('Data Cuaca');
    if (!kantorSummary) missing.push('Summary Kantor');
    if (!terminalSummary) missing.push('Summary Terminal');
    console.log(
      `[Classifier] Data tidak lengkap untuk klasifikasi tanggal ${
        classificationDate.toISOString().split('T')[0]
      }. Data yang hilang: ${missing.join(', ')}`,
    );
    return;
  }

  const classificationPromises = [];
  try {
    // 3. Panggil API ML dengan payload yang baru
    // PERBAIKAN: Tambahkan is_hari_kerja
    const dayOfWeek = classificationDate.getUTCDay();
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5 ? 1 : 0;

    // PERBAIKAN: Panggil API evaluasi per meter secara terpisah
    const terminalPromise = machineLearningService
      .evaluateTerminalUsage({
        pax: paxData.total_pax,
        suhu_rata: weatherData.avg_temp.toNumber(),
        suhu_max: weatherData.max_temp.toNumber(),
        aktual_kwh_terminal: terminalSummary.total_consumption?.toNumber() ?? 0,
      })
      .catch((e) => {
        console.error('[Classifier] Gagal evaluasi Terminal:', e.message);
        return null; // Jangan hentikan proses jika satu gagal
      });

    const kantorPromise = machineLearningService
      .evaluateKantorUsage({
        suhu_rata: weatherData.avg_temp.toNumber(),
        suhu_max: weatherData.max_temp.toNumber(),
        is_hari_kerja: isWorkday,
        aktual_kwh_kantor: kantorSummary.total_consumption?.toNumber() ?? 0,
      })
      .catch((e) => {
        console.error('[Classifier] Gagal evaluasi Kantor:', e.message);
        return null;
      });

    const [terminalResult, kantorResult] = await Promise.all([terminalPromise, kantorPromise]);

    // 4. Simpan hasil klasifikasi untuk kedua meter
    const modelVersion = 'v1.3'; // Sesuaikan dengan versi kontrak API baru

    if (terminalResult) {
      await _saveClassification(
        terminalSummary,
        terminalResult.kinerja_terminal,
        terminalResult.deviasi_persen_terminal,
        modelVersion,
      );
    }

    if (kantorResult) {
      await _saveClassification(
        kantorSummary,
        kantorResult.kinerja_kantor,
        kantorResult.deviasi_persen_kantor,
        modelVersion,
      );
    }
  } catch (error: any) {
    console.error('[Classifier] Gagal memanggil ML API:', error);
    const title = 'Error Sistem: Server Machine Learning';
    const description = `Sistem gagal terhubung ke server machine learning saat mencoba melakukan klasifikasi untuk meter ${
      classificationDate.toISOString().split('T')[0]
    }. Error: ${error.message}`;
    await prisma.alert.create({ data: { title, description } });
    return;
  }

  console.log(
    `[Classifier] Klasifikasi untuk ${classificationDate.toISOString().split('T')[0]} berhasil disimpan.`,
  );
};

export const _saveClassification = async (
  summary: Prisma.DailySummaryGetPayload<object>,
  kinerja: string,
  deviasi: number,
  modelVersion: string,
) => {
  const classification = _mapClassificationToEnum(kinerja);
  const reasoning = `Deviasi ${deviasi.toFixed(2)}% dari prediksi normal.`;

  await prisma.dailyUsageClassification.upsert({
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

  // Buat insight jika ada pemborosan
  //   if (classification === UsageCategory.BOROS) {
  //     await _createBorosInsight(summary);
  //   }
};
