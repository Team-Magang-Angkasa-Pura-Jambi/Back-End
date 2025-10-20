// src/services/reading.service.ts

import prisma from '../configs/db.js';
import { machineLearningService } from './machineLearning.service.js';
import { socketServer } from '../socket-instance.js';
import { notificationService } from './notification.service.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import {
  Prisma,
  type ReadingSession,
  RoleName,
  UsageCategory,
  type ReadingDetail,
  InsightSeverity,
} from '../generated/prisma/index.js';
import type {
  AlertStatus,
  CreateReadingSessionBody,
  GetQueryLastReading,
  GetReadingSessionsQuery,
  UpdateReadingSessionBody,
  ReadingSessionApiResponse,
} from '../types/reading.types.js';
import { Error400, Error404, Error409 } from '../utils/customError.js';

import { differenceInDays } from 'date-fns';
import { dailyLogbookService } from './dailyLogbook.service.js';
import { alertService } from './alert.service.js';
type CreateReadingSessionInternal = CreateReadingSessionBody & {
  user_id: number;
  reading_date: Date;
  skipValidation?: boolean; // BARU: Tambahkan flag untuk melewati validasi
};

type MeterWithRelations = Prisma.MeterGetPayload<{
  include: {
    energy_type: true;
    category: true;
    tariff_group: {
      include: { price_schemes: { include: { rates: true; taxes: true } } };
    };
  };
}>;

type SessionWithDetails = ReadingSession & { details: ReadingDetail[] };

type ReadingSessionWithDetails = Prisma.ReadingSessionGetPayload<{
  include: {
    meter: { include: { energy_type: true; category: true } };
    user: { select: { user_id: true; username: true } };
    details: { include: { reading_type: true } };
  };
}>;

export class ReadingService extends GenericBaseService<
  typeof prisma.readingSession,
  ReadingSession,
  CreateReadingSessionInternal,
  UpdateReadingSessionBody,
  Prisma.ReadingSessionFindManyArgs,
  Prisma.ReadingSessionFindUniqueArgs,
  Prisma.ReadingSessionCreateArgs,
  Prisma.ReadingSessionUpdateArgs,
  Prisma.ReadingSessionDeleteArgs
> {
  constructor() {
    super(prisma, prisma.readingSession, 'session_id');
    // Bind 'this' context untuk metode privat yang digunakan sebagai callback atau di dalam transaksi.
    this._updateDailySummary = this._updateDailySummary.bind(this);
    this._classifyDailyUsage = this._classifyDailyUsage.bind(this);
    this._mapClassificationToEnum = this._mapClassificationToEnum.bind(this);
  }
  private async _validateReadingsAgainstPrevious(
    meter: MeterWithRelations,
    dateForDb: Date,
    details: CreateReadingSessionInternal['details']
  ) {
    // Validasi untuk BBM (Fuel) memiliki logika yang berbeda.
    if (meter.energy_type.type_name === 'Fuel') {
      // Pastikan ketinggian yang diinput tidak melebihi kapasitas maksimal tangki.
      if (meter.tank_height_cm) {
        const tankHeight = new Prisma.Decimal(meter.tank_height_cm);
        for (const detail of details) {
          const currentValue = new Prisma.Decimal(detail.value);
          if (currentValue.greaterThan(tankHeight)) {
            throw new Error400(
              `Ketinggian BBM yang diinput (${currentValue} cm) tidak boleh melebihi kapasitas maksimal tangki (${tankHeight} cm).`
            );
          }
        }
      }
      // Validasi nilai kumulatif (harus lebih besar dari sebelumnya) tidak berlaku untuk BBM.
      return;
    }
    const previousDate = new Date(dateForDb);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);

    const previousSession = await prisma.readingSession.findUnique({
      where: {
        unique_meter_reading_per_day: {
          meter_id: meter.meter_id,
          reading_date: previousDate,
        },
      },
      include: { details: true },
    });

    if (!previousSession) {
      // Jika sesi H-1 tidak ada, cek apakah ada data lain sebelumnya.
      const anyPreviousEntry = await prisma.readingSession.findFirst({
        where: { meter_id: meter.meter_id, reading_date: { lt: dateForDb } },
      });

      if (anyPreviousEntry) {
        throw new Error400(
          `Data untuk tanggal ${
            previousDate.toISOString().split('T')[0]
          } belum diinput. Silakan input data hari sebelumnya terlebih dahulu.`
        );
      }
      // Jika tidak ada data sama sekali, ini adalah input pertama, maka validasi dilewati.
      return;
    }

    for (const detail of details) {
      const prevDetail = previousSession.details.find(
        (d) => d.reading_type_id === detail.reading_type_id
      );
      if (!prevDetail) continue;

      const previousValue = new Prisma.Decimal(prevDetail.value);
      const currentValue = new Prisma.Decimal(detail.value);

      // Validasi `currentValue < previousValue` dihapus dari sini.
      // Logika ini ditangani di dalam fungsi kalkulasi `_calculateSafeConsumption`
      // untuk mengakomodasi kasus meter reset (rollover).

      // BARU: Validasi bahwa nilai input tidak melebihi rollover_limit jika ada.
      if (meter.rollover_limit) {
        const rolloverLimit = new Prisma.Decimal(meter.rollover_limit);
        if (currentValue.greaterThan(rolloverLimit)) {
          throw new Error400(
            `Nilai input (${currentValue}) tidak boleh lebih besar dari batas reset meter (${rolloverLimit}).`
          );
        }
      }
    }
  }

  private async _validateDuplicateSession(meter_id: number, dateForDb: Date) {
    const existingSession = await prisma.readingSession.findUnique({
      where: {
        unique_meter_reading_per_day: { meter_id, reading_date: dateForDb },
      },
    });
    if (existingSession) {
      throw new Error409(
        `Data pembacaan untuk meter ini pada tanggal ${dateForDb.toISOString().split('T')[0]} sudah ada.`
      );
    }
  }

  /**
   * Fungsi utama untuk membuat atau memperbarui sesi pembacaan dan ringkasan hariannya.
   */
  public override async create(
    data: CreateReadingSessionInternal
  ): Promise<ReadingSession> {
    const { meter_id, reading_date, details, user_id, skipValidation } = data;

    const meter = await this._validateMeter(meter_id);
    const dateForDb = this._normalizeDate(reading_date);
    await this._validateDuplicateSession(meter_id, dateForDb);
    if (!skipValidation) {
      await this._validateReadingsAgainstPrevious(meter, dateForDb, details);
    }

    // Seluruh proses, termasuk kalkulasi summary, dimasukkan ke dalam satu transaksi.
    // Ini memastikan jika kalkulasi gagal (misal: karena rollover tidak valid),
    // pembuatan ReadingSession juga akan dibatalkan (rollback).
    const newSession = await this._handleCrudOperation(() =>
      this._prisma.$transaction(async (tx) => {
        const { sessionId } = await this._findOrCreateSession(
          tx,
          meter_id,
          dateForDb,
          user_id
        );
        await this._createReadingDetails(tx, sessionId, details);

        await this._updateDailySummary(tx, meter, dateForDb);

        return tx.readingSession.findUniqueOrThrow({
          where: { session_id: sessionId },
          include: {
            details: { include: { reading_type: true } },
            meter: { select: { meter_code: true } },
            user: { select: { username: true } },
          },
        });
      })
    );

    // Panggil proses sekunder (yang tidak kritikal) setelah transaksi utama berhasil.
    await this._checkAndResolveMissingDataAlert(meter_id, dateForDb);
    // PERBAIKAN: Impor dan panggil AnalysisService secara dinamis untuk memutus dependensi sirkular.
    const { AnalysisService } = await import('./analysis.service.js');
    const analysisService = new AnalysisService();
    analysisService.runPredictionForDate(dateForDb); // Jalankan di latar belakang

    return newSession;
  }

  /**
   * Memperbarui data pembacaan meter yang sudah ada.
   * Metode ini akan memvalidasi data baru, memperbarui detail dalam transaksi,
   * dan memicu kalkulasi ulang untuk tanggal yang bersangkutan dan hari berikutnya.
   * @param sessionId - ID dari ReadingSession yang akan diperbarui.
   * @param data - Data baru yang berisi detail pembacaan.
   */
  public override async update(
    sessionId: number,
    data: UpdateReadingSessionBody
  ): Promise<ReadingSession> {
    const { details } = data;

    return this._handleCrudOperation(async () => {
      const currentSession = await this._model.findUniqueOrThrow({
        where: { session_id: sessionId },
      });
      const { meter_id, reading_date } = currentSession;

      const latestSession = await this._prisma.readingSession.findFirst({
        where: { meter_id },
        orderBy: { reading_date: 'desc' },
      });

      if (latestSession && latestSession.session_id !== sessionId) {
        throw new Error400(
          'Hanya data pembacaan terakhir yang dapat diubah. Untuk memperbaiki data lama, hapus entri hingga tanggal tersebut dan input ulang.'
        );
      }

      const meter = await this._validateMeter(meter_id);
      await this._validateReadingsAgainstPrevious(meter, reading_date, details);

      const updatedSession = await this._prisma.$transaction(async (tx) => {
        await tx.readingDetail.deleteMany({
          where: { session_id: sessionId },
        });

        await this._createReadingDetails(tx, sessionId, details);

        return tx.readingSession.findUniqueOrThrow({
          where: { session_id: sessionId },
          include: {
            details: { include: { reading_type: true } },
            meter: { select: { meter_code: true } },
            user: { select: { username: true } },
          },
        });
      });

      console.log(
        `[ReadingService] Data sesi ${sessionId} diperbarui. Memicu kalkulasi ulang untuk ${
          reading_date.toISOString().split('T')[0]
        }`
      );
      await this.processAndSummarizeReading(meter_id, reading_date);

      return updatedSession;
    });
  }

  /**
   * Metode publik untuk memproses dan membuat ringkasan untuk satu meter pada tanggal tertentu.
   * Ini adalah inti logika yang diekstrak dari `create` dan `recalculate` untuk reusability.
   * @param meterId - ID meter yang akan diproses.
   * @param date - Tanggal pembacaan yang akan diproses.
   * @param tx - Konteks transaksi Prisma yang sedang berjalan.
   */
  public async processAndSummarizeReading(
    meterId: number,
    date: Date,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    return this._handleCrudOperation(async () => {
      // Gunakan 'tx' untuk query agar tetap dalam transaksi yang sama
      const meter = await tx.meter.findUniqueOrThrow({
        where: { meter_id: meterId },
        include: {
          energy_type: true,
          category: true,
          tariff_group: {
            include: {
              price_schemes: {
                include: {
                  rates: { include: { reading_type: true } },
                  taxes: { include: { tax: true } },
                },
              },
            },
          },
        },
      });

      const dateForDb = this._normalizeDate(date);

      // PERBAIKAN: _updateDailySummary sekarang menjadi pusat kalkulasi dan penyimpanan.
      const summaries = await this._updateDailySummary(tx, meter, dateForDb);

      if (summaries) {
        for (const summary of summaries) {
          // Panggil proses sekunder setelah summary utama selesai.
          await this._classifyDailyUsage(summary, meter);
          await this._checkUsageAgainstTargetAndNotify(summary, meter);
        }
      }

      console.log(
        `[ReadingService] Memicu pembuatan/pembaruan logbook untuk tanggal ${dateForDb.toISOString()}`
      );
      // PERBAIKAN: Panggil generateDailyLog di luar transaksi utama
      // untuk menghindari error jika transaksi sudah selesai.
      await dailyLogbookService.generateDailyLog(dateForDb);
    });
  }
  public override async delete(sessionId: number): Promise<ReadingSession> {
    return this._handleCrudOperation(() =>
      this._prisma.$transaction(async (tx) => {
        const sessionToDelete = await tx.readingSession.findUniqueOrThrow({
          where: { session_id: sessionId },
          select: { meter_id: true, reading_date: true },
        });

        // BARU: Validasi bahwa hanya data terakhir yang bisa dihapus.
        const latestSession = await tx.readingSession.findFirst({
          where: { meter_id: sessionToDelete.meter_id },
          orderBy: { reading_date: 'desc' },
        });

        // Jika ada sesi terakhir dan ID-nya tidak sama dengan sesi yang akan dihapus,
        // berarti pengguna mencoba menghapus data di tengah.
        if (latestSession && latestSession.session_id !== sessionId) {
          throw new Error400(
            'Hanya data pembacaan terakhir yang dapat dihapus. Untuk memperbaiki data lama, hapus entri hingga tanggal tersebut dan input ulang.'
          );
        }

        const { meter_id, reading_date } = sessionToDelete;

        await tx.dailySummary.deleteMany({
          where: {
            meter_id,
            summary_date: reading_date,
          },
        });

        await tx.dailyLogbook.deleteMany({
          where: {
            meter_id,
            log_date: reading_date,
          },
        });

        const deletedSession = await tx.readingSession.delete({
          where: { session_id: sessionId },
        });

        return deletedSession;
      })
    );
  }

  /**
   * Orkestrator untuk memperbarui DailySummary.
   * Mengambil data, memanggil kalkulator, dan menulis hasilnya ke DB.
   */
  private async _updateDailySummary(
    // PERBAIKAN: Fungsi ini sekarang menjadi pusat kalkulasi
    tx: Prisma.TransactionClient,
    meter: MeterWithRelations,
    dateForDb: Date
  ): Promise<Prisma.DailySummaryGetPayload<{}>[] | null> {
    const currentSession = await tx.readingSession.findUnique({
      where: {
        unique_meter_reading_per_day: {
          reading_date: dateForDb,
          meter_id: meter.meter_id,
        },
      },
      include: { details: true },
    });

    if (!currentSession) return null;

    // Logika pengambilan data sebelumnya dibedakan per jenis energi.
    let previousSession: SessionWithDetails | null;
    if (meter.energy_type.type_name === 'Fuel') {
      const previousFuelSession = await tx.readingSession.findFirst({
        where: {
          meter_id: meter.meter_id,
          reading_date: { lt: dateForDb },
        },
        orderBy: { reading_date: 'desc' },
        include: { details: true },
      });

      // PERBAIKAN: Panggil kalkulator BBM yang sudah diperbaiki
      return this._calculateAndDistributeFuelSummary(
        tx,
        meter,
        currentSession,
        previousFuelSession
      );
    } else {
      // Untuk Listrik dan Air, gunakan logika H-1 yang ketat.
      const previousDate = new Date(dateForDb);
      previousDate.setUTCDate(previousDate.getUTCDate() - 1);

      previousSession = await tx.readingSession.findUnique({
        where: {
          unique_meter_reading_per_day: {
            reading_date: previousDate,
            meter_id: meter.meter_id,
          },
        },
        include: { details: true },
      });
    }

    const summaryDetailsToCreate = await this._calculateSummaryDetails(
      tx,
      meter,
      currentSession,
      previousSession
    );
    if (summaryDetailsToCreate.length === 0) return null;

    // Jumlahkan biaya dari metrik dasar (bukan dari metrik "Total Pemakaian") untuk menghindari penghitungan ganda.
    const finalTotalCost = summaryDetailsToCreate.reduce(
      (sum, detail) =>
        detail.metric_name !== 'Total Pemakaian'
          ? sum.plus(detail.consumption_cost ?? 0)
          : sum,
      new Prisma.Decimal(0)
    );

    // Hitung total konsumsi dari metrik utama (bukan komponen seperti WBP/LWBP).
    const finalTotalConsumption = summaryDetailsToCreate.reduce(
      (sum, detail) =>
        !detail.metric_name.includes('WBP') &&
        !detail.metric_name.includes('LWBP')
          ? sum.plus(new Prisma.Decimal(detail.consumption_value ?? 0)) // Jumlahkan jika bukan komponen
          : sum,
      new Prisma.Decimal(0)
    );

    const dailySummary = await tx.dailySummary.upsert({
      where: {
        summary_date_meter_id: {
          summary_date: dateForDb,
          meter_id: meter.meter_id,
        },
      },
      update: {
        total_cost: finalTotalCost,
        total_consumption: finalTotalConsumption,
      },
      create: {
        summary_date: dateForDb,
        meter_id: meter.meter_id,
        total_cost: finalTotalCost,
        total_consumption: finalTotalConsumption,
      },
    });

    await tx.summaryDetail.deleteMany({
      where: { summary_id: dailySummary.summary_id },
    });
    await tx.summaryDetail.createMany({
      data: summaryDetailsToCreate.map((detail) => ({
        ...detail,
        summary_id: dailySummary.summary_id,
      })),
    });

    return [dailySummary];
  }

  private _normalizeDate(date: Date | string): Date {
    // PERBAIKAN: Logika normalisasi tanggal yang lebih andal dan anti-bug timezone.
    // 1. Buat string tanggal (YYYY-MM-DD) dari input, pastikan tidak terpengaruh timezone server.
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    // 2. Buat objek Date baru dari string tersebut. Ini akan menghasilkan tanggal pada tengah malam UTC.
    return new Date(dateString);
  }

  /**
   * Memetakan hasil string dari model ML ke tipe enum UsageCategory.
   */
  private _mapClassificationToEnum(classification: string): UsageCategory {
    const upperCaseClassification = classification.toUpperCase();
    if (upperCaseClassification.includes('HEMAT')) {
      return UsageCategory.HEMAT;
    }
    if (
      upperCaseClassification.includes('BOROS') ||
      upperCaseClassification.includes('PEMBOROSAN')
    ) {
      return UsageCategory.BOROS;
    }
    return UsageCategory.NORMAL;
  }

  /**
   * (DUMMY) Menerapkan logika untuk mengklasifikasikan penggunaan harian.
   * Di aplikasi nyata, di sinilah Anda akan memanggil model ML.
   */

  private async _classifyDailyUsage(
    summary: Prisma.DailySummaryGetPayload<{}>,
    meter: MeterWithRelations
  ) {
    if (meter.energy_type.type_name !== 'Electricity') {
      console.log(
        `[Classifier] Klasifikasi dilewati untuk tipe energi: ${meter.energy_type.type_name}`
      );
      return;
    }

    // PERBAIKAN TOTAL: Logika klasifikasi sekarang mengambil data gabungan untuk Kantor & Terminal.
    const classificationDate = summary.summary_date;

    // 1. Ambil semua data yang dibutuhkan untuk tanggal klasifikasi
    const [paxData, weatherData, kantorSummary, terminalSummary] =
      await Promise.all([
        this._prisma.paxData.findUnique({
          where: { data_date: classificationDate },
        }),
        this._prisma.weatherHistory.findUnique({
          where: { data_date: classificationDate },
        }),
        this._prisma.dailySummary.findFirst({
          where: {
            summary_date: classificationDate,
            meter: { meter_code: 'ELEC-KANTOR-01' },
          },
        }),
        this._prisma.dailySummary.findFirst({
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
        }. Data yang hilang: ${missing.join(', ')}`
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
          aktual_kwh_terminal:
            terminalSummary.total_consumption?.toNumber() ?? 0,
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

      const [terminalResult, kantorResult] = await Promise.all([
        terminalPromise,
        kantorPromise,
      ]);

      // 4. Simpan hasil klasifikasi untuk kedua meter
      const modelVersion = 'v1.3'; // Sesuaikan dengan versi kontrak API baru

      if (terminalResult) {
        await this._saveClassification(
          terminalSummary,
          terminalResult.kinerja_terminal,
          terminalResult.deviasi_persen_terminal,
          modelVersion
        );
      }

      if (kantorResult) {
        await this._saveClassification(
          kantorSummary,
          kantorResult.kinerja_kantor,
          kantorResult.deviasi_persen_kantor,
          modelVersion
        );
      }
    } catch (error) {
      console.error('[Classifier] Gagal memanggil ML API:', error);
      const title = 'Error Sistem: Server Machine Learning';
      const description = `Sistem gagal terhubung ke server machine learning saat mencoba melakukan klasifikasi untuk meter ${
        classificationDate.toISOString().split('T')[0]
      }. Error: ${error.message}`;
      await this._prisma.alert.create({ data: { title, description } });
      return;
    }

    console.log(
      `[Classifier] Klasifikasi untuk ${classificationDate.toISOString().split('T')[0]} berhasil disimpan.`
    );
  }

  /**
   * Helper untuk menyimpan hasil klasifikasi ke database.
   */
  private async _saveClassification(
    summary: Prisma.DailySummaryGetPayload<{}>,
    kinerja: string,
    deviasi: number,
    modelVersion: string
  ) {
    const classification = this._mapClassificationToEnum(kinerja);
    const reasoning = `Deviasi ${deviasi.toFixed(2)}% dari prediksi normal.`;

    await this._prisma.dailyUsageClassification.upsert({
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
    if (classification === UsageCategory.BOROS) {
      await this._createBorosInsight(summary);
    }
  }

  /**
   * Memeriksa penggunaan harian terhadap target efisiensi.
   * Jika penggunaan melebihi target, kirim notifikasi ke admin.
   */
  private async _checkUsageAgainstTargetAndNotify(
    summary: Prisma.DailySummaryGetPayload<{}>,
    meter: MeterWithRelations
  ) {
    const target = await this._prisma.efficiencyTarget.findFirst({
      where: {
        meter_id: meter.meter_id,
        period_start: { lte: summary.summary_date },
        period_end: { gte: summary.summary_date },
      },
    });

    if (!target || target.target_value.isZero()) {
      return;
    }

    const summaryDetails = await this._prisma.summaryDetail.findMany({
      where: { summary_id: summary.summary_id },
    });

    if (summaryDetails.length === 0) {
      return;
    }

    let totalConsumption: Prisma.Decimal;
    if (meter.energy_type.type_name === 'Electricity') {
      const wbp =
        summaryDetails.find((d) => d.metric_name === 'Pemakaian WBP')
          ?.consumption_value ?? new Prisma.Decimal(0);
      const lwbp =
        summaryDetails.find((d) => d.metric_name === 'Pemakaian LWBP')
          ?.consumption_value ?? new Prisma.Decimal(0);
      totalConsumption = wbp.plus(lwbp);
    } else {
      totalConsumption = summaryDetails[0].consumption_value;
    }

    if (totalConsumption.greaterThan(target.target_value)) {
      const excess = totalConsumption.minus(target.target_value);
      const percentage = excess.div(target.target_value).times(100).toFixed(2);

      const admins = await this._prisma.user.findMany({
        where: {
          role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
        },
        select: { user_id: true },
      });

      const message = `Pemakaian harian untuk meteran ${meter.meter_code} melebihi target sebesar ${percentage}%.`;
      const title = 'Peringatan: Target Efisiensi Terlampaui';

      await this._prisma.analyticsInsight.create({
        data: {
          title,
          description: message,
          severity: InsightSeverity.MEDIUM,
          insight_date: summary.summary_date,
          meter_id: meter.meter_id,
          source_data_ref: {
            summaryId: summary.summary_id,
            targetId: target.target_id,
          },
        },
      });
    }
  }
  /**
   * Pusat logika bisnis untuk menghitung semua detail konsumsi dan biaya.
   * Mengembalikan array data yang siap dimasukkan ke tabel SummaryDetail.
   */
  private async _calculateSummaryDetails(
    tx: Prisma.TransactionClient,
    meter: MeterWithRelations,
    currentSession: SessionWithDetails,
    previousSession: SessionWithDetails | null
  ): Promise<
    Omit<Prisma.SummaryDetailCreateInput, 'summary' | 'summary_id'>[]
  > {
    const activePriceScheme = await this._getLatestPriceScheme(
      tx,
      meter.tariff_group,
      currentSession.reading_date
    );
    const summaryDetails: Omit<
      Prisma.SummaryDetailCreateInput,
      'summary' | 'summary_id'
    >[] = [];

    if (meter.energy_type.type_name === 'Electricity') {
      return this._calculateElectricitySummary(
        tx,
        meter,
        currentSession,
        previousSession,
        activePriceScheme
      );
    }

    if (meter.energy_type.type_name === 'Water') {
      return this._calculateWaterSummary(
        tx,
        meter,
        currentSession,
        previousSession,
        activePriceScheme
      );
    }

    return summaryDetails;
  }

  /**
   * Logika kalkulasi khusus untuk BBM yang diinput secara periodik (misal: bulanan).
   * Fungsi ini akan mendistribusikan total konsumsi ke dalam ringkasan harian.
   */
  private async _calculateAndDistributeFuelSummary(
    tx: Prisma.TransactionClient,
    meter: MeterWithRelations,
    currentSession: SessionWithDetails,
    previousSession: SessionWithDetails | null
  ): Promise<Prisma.DailySummaryGetPayload<{}>[]> {
    const priceScheme = await this._getLatestPriceScheme(
      tx,
      meter.tariff_group_id,
      currentSession.reading_date
    );

    if (!previousSession) {
      console.log(
        `[ReadingService] First fuel entry for meter ${meter.meter_code}. Creating initial summary with 0 consumption.`
      );
      const initialSummaryDetails = await this._calculateFuelSummary(
        tx,
        meter,
        currentSession,
        null,
        priceScheme
      );
      // PERBAIKAN: Gunakan _createOrUpdateDistributedSummary yang sudah diperbaiki
      const summary = await this._createOrUpdateDistributedSummary(
        tx,
        meter,
        currentSession.reading_date,
        initialSummaryDetails
      );
      return [summary];
    }

    // Hitung total konsumsi untuk periode ini
    const summaryDetails = await this._calculateFuelSummary(
      tx,
      meter,
      currentSession,
      previousSession,
      priceScheme
    );

    if (summaryDetails.length === 0) {
      return [];
    }

    // PERBAIKAN: Buat SATU DailySummary pada tanggal pembacaan saat ini
    // yang berisi TOTAL konsumsi selama periode tersebut.
    const summary = await this._createSingleSummaryFromDetails(
      tx,
      meter.meter_id,
      currentSession.reading_date,
      summaryDetails
    );

    // PERBAIKAN: Simpan detail kalkulasi (termasuk remaining_stock) ke SummaryDetail.
    // Ini adalah langkah yang hilang sebelumnya.
    if (summary) {
      await tx.summaryDetail.deleteMany({
        where: { summary_id: summary.summary_id },
      });
      await tx.summaryDetail.createMany({
        data: summaryDetails.map((detail) => ({
          ...detail,
          summary_id: summary.summary_id,
        })),
      });
    }

    console.log(
      `[ReadingService] Created a single fuel summary for meter ${meter.meter_code} on ${currentSession.reading_date.toISOString().split('T')[0]}.`
    );
    return summary ? [summary] : [];
  }

  private async _calculateElectricitySummary(
    tx: Prisma.TransactionClient,
    meter: MeterWithRelations,
    currentSession: SessionWithDetails,
    previousSession: SessionWithDetails | null,
    priceScheme: Prisma.PriceSchemeGetPayload<{
      include: { rates: { include: { reading_type: true } } };
    }> | null
  ) {
    if (!priceScheme) {
      throw new Error404(
        `Konfigurasi harga untuk golongan tarif '${
          meter.tariff_group.group_code
        }' pada tanggal ${
          currentSession.reading_date.toISOString().split('T')[0]
        } tidak ditemukan.`
      );
    }

    // PERBAIKAN: Ambil tipe bacaan WBP dan LWBP langsung dari DB untuk keandalan.
    const wbpType = await tx.readingType.findUnique({
      where: { type_name: 'WBP' },
    });
    const lwbpType = await tx.readingType.findUnique({
      where: { type_name: 'LWBP' },
    });

    if (!wbpType || !lwbpType) {
      // Error ini sekarang mengindikasikan masalah pada data master, bukan skema harga.
      throw new Error500(
        'Konfigurasi sistem error: Tipe bacaan WBP atau LWBP tidak ditemukan di database.'
      );
    }

    const getDetailValue = (
      session: SessionWithDetails | null,
      typeId: number
    ) => session?.details.find((d) => d.reading_type_id === typeId)?.value;

    const faktorKali = new Prisma.Decimal(meter.tariff_group?.faktor_kali ?? 1);

    const rateWbp = priceScheme.rates.find(
      (r) => r.reading_type_id === wbpType.reading_type_id
    );
    const rateLwbp = priceScheme.rates.find(
      (r) => r.reading_type_id === lwbpType.reading_type_id
    );

    if (!rateWbp || !rateLwbp) {
      throw new Error404(
        `Tarif WBP atau LWBP tidak terdefinisi dalam skema harga '${priceScheme.scheme_name}'.`
      );
    }

    const HARGA_WBP = new Prisma.Decimal(rateWbp.value);
    const HARGA_LWBP = new Prisma.Decimal(rateLwbp.value);

    const wbpConsumption = this._calculateSafeConsumption(
      // PERBAIKAN: Gunakan _calculateSafeConsumption
      getDetailValue(currentSession, wbpType.reading_type_id),
      getDetailValue(previousSession, wbpType.reading_type_id),
      meter.rollover_limit
    );
    const lwbpConsumption = this._calculateSafeConsumption(
      // PERBAIKAN: Gunakan _calculateSafeConsumption
      getDetailValue(currentSession, lwbpType.reading_type_id),
      getDetailValue(previousSession, lwbpType.reading_type_id),
      meter.rollover_limit
    );
    const wbpCost = wbpConsumption.times(faktorKali).times(HARGA_WBP);
    const lwbpCost = lwbpConsumption.times(faktorKali).times(HARGA_LWBP);

    const summaryDetails: Omit<
      Prisma.SummaryDetailCreateInput,
      'summary' | 'summary_id'
    >[] = [
      {
        metric_name: 'Pemakaian WBP',
        energy_type_id: meter.energy_type_id,
        current_reading:
          getDetailValue(currentSession, wbpType.reading_type_id) ??
          new Prisma.Decimal(0),
        previous_reading:
          getDetailValue(previousSession, wbpType.reading_type_id) ??
          new Prisma.Decimal(0),
        consumption_value: wbpConsumption,
        consumption_cost: wbpCost,
        wbp_value: wbpConsumption,
      },
      {
        metric_name: 'Pemakaian LWBP',
        energy_type_id: meter.energy_type_id,
        current_reading:
          getDetailValue(currentSession, lwbpType.reading_type_id) ??
          new Prisma.Decimal(0),
        previous_reading:
          getDetailValue(previousSession, lwbpType.reading_type_id) ??
          new Prisma.Decimal(0),
        consumption_value: lwbpConsumption,
        consumption_cost: lwbpCost,
        lwbp_value: lwbpConsumption,
      },
    ];

    summaryDetails.push({
      metric_name: 'Total Pemakaian',
      energy_type_id: meter.energy_type_id,
      current_reading: new Prisma.Decimal(0),
      previous_reading: new Prisma.Decimal(0),
      consumption_value: wbpConsumption.plus(lwbpConsumption), // Total konsumsi adalah jumlah WBP dan LWBP sebelum dikali faktor kali.
      consumption_cost: wbpCost.plus(lwbpCost), // Total biaya dari WBP dan LWBP
    });

    return summaryDetails;
  }

  private async _calculateWaterSummary(
    tx: Prisma.TransactionClient,
    meter: MeterWithRelations,
    currentSession: SessionWithDetails,
    previousSession: SessionWithDetails | null,
    priceScheme: Prisma.PriceSchemeGetPayload<{
      include: { rates: true };
    }> | null
  ) {
    if (!priceScheme) {
      throw new Error404(
        `Konfigurasi harga untuk golongan tarif '${
          meter.tariff_group.group_code
        }' pada tanggal ${
          currentSession.reading_date.toISOString().split('T')[0]
        } tidak ditemukan.`
      );
    }

    const mainType = await tx.readingType.findFirst({
      where: { energy_type_id: meter.energy_type_id },
    });
    if (!mainType) return [];

    const getDetailValue = (
      session: SessionWithDetails | null,
      typeId: number
    ) => session?.details.find((d) => d.reading_type_id === typeId)?.value;

    const rate = priceScheme.rates.find(
      (r) => r.reading_type_id === mainType.reading_type_id
    );

    if (!rate) {
      throw new Error404(
        `Tarif untuk '${mainType.type_name}' tidak terdefinisi dalam skema harga '${priceScheme.scheme_name}'.`
      );
    }
    const HARGA_SATUAN = new Prisma.Decimal(rate.value);
    const consumption = this._calculateSafeConsumption(
      getDetailValue(currentSession, mainType.reading_type_id),
      getDetailValue(previousSession, mainType.reading_type_id),
      meter.rollover_limit
    );

    return [
      {
        metric_name: `Pemakaian Harian (${meter.energy_type.unit_of_measurement})`,
        energy_type_id: meter.energy_type_id,
        current_reading:
          getDetailValue(currentSession, mainType.reading_type_id) ??
          new Prisma.Decimal(0),
        previous_reading:
          getDetailValue(previousSession, mainType.reading_type_id) ??
          new Prisma.Decimal(0),
        consumption_value: consumption,
        consumption_cost: consumption.times(HARGA_SATUAN),
      },
    ];
  }

  private async _calculateFuelSummary(
    tx: Prisma.TransactionClient,
    meter: MeterWithRelations,
    currentSession: SessionWithDetails,
    previousSession: SessionWithDetails | null,
    priceScheme: Prisma.PriceSchemeGetPayload<{
      include: { rates: true };
    }> | null
  ) {
    if (!priceScheme) {
      throw new Error404(
        `Konfigurasi harga untuk golongan tarif '${
          meter.tariff_group.group_code
        }' pada tanggal ${
          currentSession.reading_date.toISOString().split('T')[0]
        } tidak ditemukan.`
      );
    }

    if (
      !meter.tank_height_cm ||
      !meter.tank_volume_liters ||
      meter.tank_height_cm.isZero()
    ) {
      throw new Error400(
        `Konfigurasi tangki (tinggi & volume) untuk meter '${meter.meter_code}' belum diatur atau tidak valid.`
      );
    }

    const litersPerCm = meter.tank_volume_liters.div(meter.tank_height_cm);

    const mainType = await tx.readingType.findFirst({
      where: { energy_type_id: meter.energy_type_id },
    });
    if (!mainType) return [];

    const getDetailValue = (
      session: SessionWithDetails | null,
      typeId: number
    ) => session?.details.find((d) => d.reading_type_id === typeId)?.value;

    const rate = priceScheme.rates.find(
      (r) => r.reading_type_id === mainType.reading_type_id
    );

    if (!rate) {
      throw new Error404(
        `Tarif untuk '${mainType.type_name}' tidak terdefinisi dalam skema harga '${priceScheme.scheme_name}'.`
      );
    }
    const HARGA_SATUAN = new Prisma.Decimal(rate.value);

    const currentHeight =
      getDetailValue(currentSession, mainType.reading_type_id) ??
      new Prisma.Decimal(0);
    const previousHeight =
      getDetailValue(previousSession, mainType.reading_type_id) ??
      new Prisma.Decimal(0);

    const heightDifference = previousHeight.minus(currentHeight);
    let consumptionInLiters: Prisma.Decimal;

    if (heightDifference.isNegative()) {
      // Jika ketinggian naik, berarti ada pengisian. Konsumsi dianggap 0.
      consumptionInLiters = new Prisma.Decimal(0);

      // Selesaikan (resolve) alert "Stok BBM Menipis" yang ada untuk meter ini.
      const lowFuelAlertTitle = `Peringatan: Stok BBM Menipis`;
      const alertsToResolve = await tx.alert.findMany({
        where: {
          meter_id: meter.meter_id,
          title: lowFuelAlertTitle,
          status: 'NEW',
        },
      });

      if (alertsToResolve.length > 0) {
        const alertIds = alertsToResolve.map((a) => a.alert_id);
        await tx.alert.updateMany({
          where: {
            alert_id: { in: alertIds },
          },
          data: {
            status: 'HANDLED',
            acknowledged_by_user_id: currentSession.user_id,
          },
        });
        console.log(
          `[ReadingService] Resolved ${alertsToResolve.length} low fuel alerts for meter ${meter.meter_code} due to refill.`
        );
      }

      // Kirim notifikasi jika tangki diisi penuh (currentHeight sama dengan tinggi maksimal tangki).
      if (meter.tank_height_cm && currentHeight.equals(meter.tank_height_cm)) {
        const admins = await tx.user.findMany({
          where: {
            role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
            is_active: true,
          },
          select: { user_id: true },
        });

        const title = `Info: Pengisian Penuh BBM Terdeteksi`;
        const message = `Telah terjadi pengisian penuh BBM untuk meter '${
          meter.meter_code
        }'. Ketinggian mencapai kapasitas maksimal: ${currentHeight.toFixed(
          2
        )} cm.`;

        for (const admin of admins) {
          await notificationService.create({
            user_id: admin.user_id,
            title,
            message,
          });
        }
        console.log(
          `[ReadingService] Full fuel refill detected for meter ${meter.meter_code}. Notification sent.`
        );
      }
    } else {
      consumptionInLiters = heightDifference.times(litersPerCm);

      // Cek apakah level BBM menipis dan kirim notifikasi/alert.
      // PERBAIKAN: Pindahkan threshold ke variabel yang jelas
      const LOW_FUEL_THRESHOLD_CM = new Prisma.Decimal(20);

      if (
        currentHeight.lessThan(LOW_FUEL_THRESHOLD_CM) && // Ketinggian saat ini di bawah batas
        previousHeight.greaterThanOrEqualTo(LOW_FUEL_THRESHOLD_CM)
      ) {
        const title = `Peringatan: Stok BBM Menipis`;
        const message = `Stok BBM untuk meter '${
          meter.meter_code
        }' telah mencapai level rendah (${currentHeight.toFixed(
          2
        )} cm). Mohon segera lakukan pengisian ulang.`;

        await alertService.create({
          title,
          description: message,
          meter_id: meter.meter_id,
        });

        const admins = await tx.user.findMany({
          where: {
            role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
            is_active: true,
          },
          select: { user_id: true },
        });

        for (const admin of admins) {
          await notificationService.create({
            user_id: admin.user_id,
            title,
            message,
          });
        }
        console.log(
          `[ReadingService] Low fuel level detected for meter ${meter.meter_code}. Alert sent.`
        );
      }
    }

    // BARU: Hitung sisa stok dalam liter berdasarkan ketinggian saat ini.
    const remainingStockLiters = currentHeight.times(litersPerCm);

    return [
      {
        metric_name: `Pemakaian Harian (${meter.energy_type.unit_of_measurement})`,
        energy_type_id: meter.energy_type_id,
        current_reading: currentHeight,
        previous_reading: previousHeight,
        consumption_value: consumptionInLiters, // Catat konsumsi dalam liter
        consumption_cost: consumptionInLiters.times(HARGA_SATUAN),
        // BARU: Sertakan sisa stok dalam hasil kalkulasi
        remaining_stock: remainingStockLiters,
      },
    ];
  }

  /**
   * Helper untuk membuat atau memperbarui DailySummary dengan data BBM yang didistribusikan.
   */
  private async _createOrUpdateDistributedSummary(
    tx: Prisma.TransactionClient,
    meter: MeterWithRelations,
    date: Date, // Tanggal ringkasan
    summaryDetails: Omit<
      Prisma.SummaryDetailCreateInput,
      'summary' | 'summary_id'
    >[]
  ): Promise<Prisma.DailySummaryGetPayload<{}>> {
    const totalConsumption =
      summaryDetails[0]?.consumption_value ?? new Prisma.Decimal(0);
    const totalCost =
      summaryDetails[0]?.consumption_cost ?? new Prisma.Decimal(0);

    const summary = await tx.dailySummary.upsert({
      where: {
        summary_date_meter_id: {
          summary_date: date,
          meter_id: meter.meter_id,
        },
      },
      update: { total_consumption: totalConsumption, total_cost: totalCost },
      create: {
        summary_date: date,
        meter_id: meter.meter_id,
        total_consumption: totalConsumption,
        total_cost: totalCost,
      },
    });

    await tx.summaryDetail.deleteMany({
      where: { summary_id: summary.summary_id },
    });
    // PERBAIKAN: Simpan semua detail yang sudah dihitung, termasuk `remaining_stock`.
    await tx.summaryDetail.createMany({
      data: summaryDetails.map((detail) => ({
        ...detail,
        summary_id: summary.summary_id,
      })),
    });

    return summary;
  }

  /**
   * Helper untuk membuat satu DailySummary dari array detail kalkulasi.
   */
  private async _createSingleSummaryFromDetails(
    tx: Prisma.TransactionClient,
    meterId: number,
    date: Date,
    details: Omit<Prisma.SummaryDetailCreateInput, 'summary' | 'summary_id'>[]
  ): Promise<Prisma.DailySummaryGetPayload<{}> | null> {
    if (details.length === 0) return null;

    const totalCost = details[0].consumption_cost ?? new Prisma.Decimal(0);
    const totalConsumption =
      details[0].consumption_value ?? new Prisma.Decimal(0);

    // PERBAIKAN: Gunakan 'upsert' bukan 'create' untuk menghindari error duplikasi
    // saat kalkulasi ulang dijalankan lebih dari sekali.
    const summary = await tx.dailySummary.upsert({
      where: {
        summary_date_meter_id: {
          summary_date: date,
          meter_id: meterId,
        },
      },
      update: {
        total_cost: totalCost,
        total_consumption: totalConsumption,
      },
      create: {
        summary_date: date,
        meter_id: meterId,
        total_cost: totalCost,
        total_consumption: totalConsumption,
      },
    });
    return summary;
  }

  private async _getLatestPriceScheme(
    tx: Prisma.TransactionClient,
    tariffGroupOrId:
      | number
      | Prisma.TariffGroupGetPayload<{
          include: { price_schemes: { include: { rates: true; taxes: true } } };
        }>,
    date: Date
  ) {
    if (
      typeof tariffGroupOrId === 'object' &&
      'price_schemes' in tariffGroupOrId
    ) {
      return (
        tariffGroupOrId.price_schemes
          .filter((ps) => ps.effective_date <= date && ps.is_active)
          .sort(
            (a, b) => b.effective_date.getTime() - a.effective_date.getTime()
          )[0] || null
      );
    } else {
      return tx.priceScheme.findFirst({
        where: {
          tariff_group_id: tariffGroupOrId as number,
          effective_date: { lte: date },
          is_active: true,
        },
        orderBy: { effective_date: 'desc' },
        include: {
          rates: { include: { reading_type: true } },
          taxes: { include: { tax: true } },
        },
      });
    }
  }

  private _calculateSafeConsumption(
    currentValue?: Prisma.Decimal,
    previousValue?: Prisma.Decimal,
    rolloverLimit?: Prisma.Decimal | null
  ): Prisma.Decimal {
    const current = currentValue ?? new Prisma.Decimal(0);
    const previous = previousValue ?? new Prisma.Decimal(0);

    if (current.lessThan(previous)) {
      // Jika nilai saat ini lebih kecil, kemungkinan terjadi reset meter (rollover).
      // Tambahkan kondisi cerdas: rollover hanya valid jika nilai sebelumnya > 90% dari limit
      // dan nilai saat ini < 10% dari limit.
      if (
        rolloverLimit &&
        !rolloverLimit.isZero() &&
        previous.greaterThan(rolloverLimit.times(0.9)) &&
        current.lessThan(rolloverLimit.times(0.1))
      ) {
        // Rumus konsumsi saat rollover: (batas_limit - nilai_sebelumnya) + nilai_sekarang
        const consumptionBeforeReset = rolloverLimit.minus(previous);
        const consumptionAfterReset = current;
        return consumptionBeforeReset.plus(consumptionAfterReset);
      } else {
        // Jika tidak memenuhi kriteria rollover, ini adalah input yang salah.
        throw new Error400(
          `Nilai baru (${current}) tidak boleh lebih kecil dari nilai sebelumnya (${previous}) untuk meteran yang tidak memiliki batas reset (rollover).`
        );
      }
    }
    return current.minus(previous);
  }

  private async _validateMeter(meter_id: number): Promise<MeterWithRelations> {
    const meter = await prisma.meter.findUnique({
      where: { meter_id },
      include: {
        energy_type: true,
        category: true,
        tariff_group: {
          include: {
            price_schemes: { include: { rates: true, taxes: true } },
          },
        },
      },
    });
    if (!meter)
      throw new Error404(`Meteran dengan ID ${meter_id} tidak ditemukan.`);
    if (meter.status === 'Deleted')
      throw new Error400(`Meteran dengan ID ${meter_id} sudah dihapus.`);
    return meter;
  }

  private async _findOrCreateSession(
    tx: Prisma.TransactionClient,
    meter_id: number,
    reading_date: Date,
    user_id: number
  ) {
    const existingSession = await tx.readingSession.findUnique({
      where: { unique_meter_reading_per_day: { reading_date, meter_id } },
    });
    if (existingSession) return { sessionId: existingSession.session_id };

    const newSession = await tx.readingSession.create({
      data: { meter_id, user_id, reading_date },
    });
    return { sessionId: newSession.session_id };
  }

  private async _createReadingDetails(
    tx: Prisma.TransactionClient,
    sessionId: number,
    details: CreateReadingSessionInternal['details']
  ) {
    const detailsToCreate = details.map((detail) => ({
      session_id: sessionId,
      reading_type_id: detail.reading_type_id,
      value: detail.value,
    }));
    await tx.readingDetail.createMany({ data: detailsToCreate });
  }

  private async _recalculateKwhTotal(
    tx: Prisma.TransactionClient,
    sessionId: number
  ) {
    const sessionDetails = await tx.readingDetail.findMany({
      where: { session_id: sessionId },
      include: { reading_type: true },
    });

    const wbpDetail = sessionDetails.find(
      (d) => d.reading_type.type_name === 'WBP'
    );
    const lwbpDetail = sessionDetails.find(
      (d) => d.reading_type.type_name === 'LWBP'
    );
    const kwhTotalType = await tx.readingType.findFirst({
      where: { type_name: 'kWh_Total' },
    });

    if (wbpDetail && lwbpDetail && kwhTotalType) {
      const newKwhTotal = new Prisma.Decimal(wbpDetail.value).plus(
        lwbpDetail.value
      );
      await tx.readingDetail.upsert({
        where: {
          session_id_reading_type_id: {
            session_id: sessionId,
            reading_type_id: kwhTotalType.reading_type_id,
          },
        },
        update: { value: newKwhTotal },
        create: {
          session_id: sessionId,
          reading_type_id: kwhTotalType.reading_type_id,
          value: newKwhTotal,
        },
      });
    }
  }

  public async findAllWithFilters(
    query: GetReadingSessionsQuery
  ): Promise<ReadingSessionWithDetails[]> {
    const { energyTypeName, date, meterId, userId } = query;
    const whereClause: Prisma.ReadingSessionWhereInput = {};

    if (energyTypeName)
      whereClause.meter = { energy_type: { type_name: energyTypeName } };
    if (date) {
      const readingDate = new Date(date);
      readingDate.setUTCHours(0, 0, 0, 0);
      whereClause.reading_date = readingDate;
    }
    if (meterId) whereClause.meter_id = meterId;
    if (userId) whereClause.user_id = userId;

    return this._handleCrudOperation(() =>
      this._model.findMany({
        where: whereClause,
        include: {
          meter: { include: { energy_type: true } },
          user: { select: { user_id: true, username: true } },
          details: { include: { reading_type: true } },
          // correction_for: { include: { details: true } },
        },
        orderBy: { created_at: 'desc' },
      })
    );
  }

  /**
   * Menemukan satu sesi pembacaan berdasarkan ID dengan relasi spesifik.
   */
  public override async findById(
    sessionId: number
  ): Promise<ReadingSessionWithDetails> {
    const includeArgs = {
      meter: { include: { energy_type: true } },
      user: { select: { user_id: true, username: true } },
      details: { include: { reading_type: true } },
    };
    return super.findById(sessionId, { include: includeArgs });
  }

  /**
   * Menemukan semua sesi, selalu menyertakan relasi dasar.
   */
  public override async findAll(
    args?: Prisma.ReadingSessionFindManyArgs
  ): Promise<ReadingSessionWithDetails[]> {
    const includeArgs = {
      meter: { include: { energy_type: true } },
      user: { select: { user_id: true, username: true } },
      details: { include: { reading_type: true } },
    };
    const findArgs = { ...args, include: { ...args?.include, ...includeArgs } };
    return super.findAll(findArgs);
  }

  public async findLastReading(query: GetQueryLastReading) {
    const { meterId, readingTypeId, readingDate } = query;
    const dateForDb = this._normalizeDate(readingDate);

    // MODIFIKASI: Hitung tanggal H-1 secara eksplisit
    const previousDate = new Date(dateForDb);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);

    return this._handleCrudOperation(() =>
      prisma.readingDetail.findFirst({
        where: {
          reading_type_id: readingTypeId,
          session: { meter_id: meterId, reading_date: previousDate },
        },
        select: {
          value: true,
          reading_type_id: true,
          session: {
            select: {
              reading_date: true,
            },
          },
        },
      })
    );
  }

  public async getHistory(
    query: GetReadingSessionsQuery
  ): Promise<ReadingSessionApiResponse> {
    const { energyTypeName, startDate, endDate, meterId, sortBy, sortOrder } =
      query;

    return this._handleCrudOperation(async () => {
      const whereClause = this._buildWhereClause(
        query.date,
        energyTypeName,
        startDate,
        endDate,
        meterId
      );

      const orderByClause = this._buildOrderByClause(sortBy, sortOrder);

      // BARU: Ambil data sesi dan data pax secara paralel
      const [readingSessions, paxData] = await Promise.all([
        this._prisma.readingSession.findMany({
          where: whereClause,
          include: {
            meter: {
              include: {
                energy_type: true,
                daily_logbooks: {
                  where: {
                    log_date: whereClause.reading_date, // Filter logbook berdasarkan rentang tanggal yang sama
                  },
                },
              },
            },
            user: {
              select: {
                username: true,
              },
            },
            details: {
              include: {
                reading_type: {
                  select: {
                    type_name: true,
                  },
                },
              },
              orderBy: {
                reading_type_id: 'asc',
              },
            },
          },
          orderBy: orderByClause,
        }),
        this._prisma.paxData.findMany({
          where: {
            data_date: whereClause.reading_date,
          },
        }),
      ]);

      // BARU: Buat Map untuk akses cepat ke data pax
      const paxDataMap = new Map(
        paxData.map((p) => [
          p.data_date.toISOString().split('T')[0],
          { total_pax: p.total_pax, pax_id: p.pax_id },
        ])
      );

      // BARU: Gabungkan data pax ke dalam setiap sesi pembacaan
      const dataWithPax = readingSessions.map((session) => {
        const dateString = session.reading_date.toISOString().split('T')[0];
        const paxInfo = paxDataMap.get(dateString);
        return {
          ...session,
          // PERBAIKAN: Kirim pax (jumlah) dan pax_id secara terpisah
          pax: paxInfo?.total_pax ?? null,
          pax_id: paxInfo?.pax_id ?? null,
        };
      });

      return {
        data: dataWithPax,
        message: 'Successfully retrieved reading history.',
      };
    });
  }

  private _buildWhereClause(
    date?: string,
    energyTypeName?: string,
    startDate?: string,
    endDate?: string,
    meterId?: number
  ): Prisma.ReadingSessionWhereInput {
    const where: Prisma.ReadingSessionWhereInput = {};

    if (energyTypeName) {
      where.meter = {
        ...where.meter,
        energy_type: { type_name: energyTypeName },
      };
    }

    if (meterId) {
      where.meter = {
        ...where.meter,
        meter_id: meterId,
      };
    }

    if (date) {
      where.reading_date = this._normalizeDate(date);
    } else if (startDate && endDate) {
      where.reading_date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    return where;
  }

  /**
   * Membangun objek 'orderBy' Prisma secara dinamis.
   */
  private _buildOrderByClause(
    sortBy: 'reading_date' | 'created_at' = 'reading_date',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Prisma.ReadingSessionOrderByWithRelationInput {
    const orderBy: Prisma.ReadingSessionOrderByWithRelationInput = {};

    if (sortBy === 'reading_date') {
      orderBy.reading_date = sortOrder;
    } else if (sortBy === 'created_at') {
      orderBy.created_at = sortOrder;
    }

    return orderBy;
  }

  /**
   * Memeriksa dan menyelesaikan alert "Data Harian Belum Lengkap" untuk meter spesifik
   * setelah data baru diinput.
   * @param meterId - ID dari meter yang datanya baru diinput.
   * @param dateForDb - Tanggal pembacaan.
   */
  private async _checkAndResolveMissingDataAlert(
    meterId: number,
    dateForDb: Date
  ): Promise<void> {
    const alertTitle = 'Peringatan: Data Harian Belum Lengkap';
    const dateString = dateForDb.toISOString().split('T')[0];

    const alert = await this._prisma.alert.findFirst({
      where: {
        meter_id: meterId,
        title: alertTitle,
        description: {
          contains: dateString,
        },
        status: 'NEW',
      },
    });

    if (!alert) {
      return;
    }

    console.log(
      `[ReadingService] Alert data hilang ditemukan untuk meter ${meterId} pada ${dateString}. Memeriksa ulang kelengkapan...`
    );

    const [meter, session, wbpType, lwbpType] = await Promise.all([
      this._prisma.meter.findUnique({
        where: { meter_id: meterId },
        include: { category: true },
      }),
      this._prisma.readingSession.findUnique({
        where: {
          unique_meter_reading_per_day: {
            meter_id: meterId,
            reading_date: dateForDb,
          },
        },
        include: { details: { select: { reading_type_id: true } } },
      }),
      this._prisma.readingType.findUnique({ where: { type_name: 'WBP' } }),
      this._prisma.readingType.findUnique({ where: { type_name: 'LWBP' } }),
    ]);

    if (!meter || !session || !wbpType || !lwbpType) {
      return;
    }

    let isDataComplete = true;
    if (meter.category.name.includes('Terminal')) {
      const detailTypeIds = new Set(
        session.details.map((det) => det.reading_type_id)
      );
      if (
        !detailTypeIds.has(wbpType.reading_type_id) ||
        !detailTypeIds.has(lwbpType.reading_type_id)
      ) {
        isDataComplete = false;
      }
    } else if (session.details.length === 0) {
      isDataComplete = false;
    }

    if (isDataComplete) {
      await this._prisma.alert.update({
        where: { alert_id: alert.alert_id },
        data: { status: 'HANDLED' },
      });
      console.log(
        `[ReadingService] Data untuk meter ${meterId} pada ${dateString} telah lengkap. Alert ${alert.alert_id} diubah menjadi HANDLED.`
      );
    }
  }
}

// export const readingService = new ReadingService();
