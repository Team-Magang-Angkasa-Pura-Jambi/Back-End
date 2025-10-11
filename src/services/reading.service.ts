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
} from '../generated/prisma/index.js';
import type {
  CreateReadingSessionBody,
  GetQueryLastReading,
  GetReadingSessionsQuery,
  UpdateReadingSessionBody,
} from '../types/reading.types.js';
import { Error400, Error404, Error409 } from '../utils/customError.js';

// =============================================
// KONSTANTA & FALLBACK
// =============================================

// BARU: Konstanta untuk kalkulasi BBM.
// Nanti bisa dipindahkan ke properti setiap meter di database.
const TANK_HEIGHT_CM = new Prisma.Decimal(200); // Contoh: Tinggi total tangki 200 cm
const TANK_VOLUME_LITERS = new Prisma.Decimal(5000); // Contoh: Volume total tangki 5000 liter
const LITERS_PER_CM = TANK_VOLUME_LITERS.div(TANK_HEIGHT_CM); // Liter per cm ketinggian

// =============================================
// TIPE DATA LOKAL
// =============================================
type CreateReadingSessionInternal = CreateReadingSessionBody & {
  user_id: number;
  reading_date: Date;
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
    // PERBAIKAN: Bind 'this' context untuk metode privat yang digunakan sebagai callback atau di dalam transaksi.
    this._updateDailySummary = this._updateDailySummary.bind(this);
    this._classifyDailyUsage = this._classifyDailyUsage.bind(this);
    this._mapClassificationToEnum = this._mapClassificationToEnum.bind(this);
  }
  private async _validateReadingsAgainstPrevious(
    meter: MeterWithRelations,
    dateForDb: Date,
    details: CreateReadingSessionInternal['details']
  ) {
    // Langsung lewati validasi jika tipe energi adalah BBM (Fuel)
    if (meter.energy_type.type_name === 'Fuel') {
      return;
    }
    // MODIFIKASI: Cari data spesifik dari H-1.
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

    // Jika sesi H-1 tidak ditemukan
    if (!previousSession) {
      // Cek apakah ada data lain sebelum tanggal input. Jika ada, berarti H-1 memang kosong.
      const anyPreviousEntry = await prisma.readingSession.findFirst({
        where: { meter_id: meter.meter_id, reading_date: { lt: dateForDb } },
      });

      // Jika ada data sebelumnya tapi bukan di H-1, maka proses gagal.
      if (anyPreviousEntry) {
        throw new Error400(
          `Data untuk tanggal ${
            previousDate.toISOString().split('T')[0]
          } belum diinput. Silakan input data hari sebelumnya terlebih dahulu.`
        );
      }
      // Jika tidak ada data sama sekali, ini adalah input pertama, jadi validasi dilewati.
      return;
    }

    // Jika sesi H-1 ditemukan, lanjutkan validasi nilai.
    for (const detail of details) {
      const prevDetail = previousSession.details.find(
        (d) => d.reading_type_id === detail.reading_type_id
      );
      if (!prevDetail) continue;

      const previousValue = new Prisma.Decimal(prevDetail.value);
      const currentValue = new Prisma.Decimal(detail.value);

      if (currentValue.lessThan(previousValue)) {
        const readingType = await prisma.readingType.findUnique({
          where: { reading_type_id: detail.reading_type_id },
        });
        throw new Error400(
          `Nilai untuk '${readingType?.type_name}' (${currentValue}) tidak boleh lebih kecil dari pembacaan di tanggal ${
            previousDate.toISOString().split('T')[0]
          } (${previousValue}).`
        );
      }
    }
  }

  private async _validateDuplicateReadings(
    meter_id: number,
    dateForDb: Date,
    details: CreateReadingSessionInternal['details']
  ) {
    // Jalankan semua pengecekan secara paralel untuk efisiensi
    await Promise.all(
      details.map(async (detail) => {
        const existingDetail = await prisma.readingDetail.findFirst({
          where: {
            reading_type_id: detail.reading_type_id,
            session: {
              meter_id: meter_id,
              reading_date: dateForDb,
            },
          },
          include: {
            reading_type: true,
          },
        });

        if (existingDetail) {
          throw new Error409(
            `Data pembacaan untuk tipe '${
              existingDetail.reading_type.type_name
            }' pada tanggal ini sudah ada.`
          );
        }
      })
    );
  }

  /**
   * Fungsi utama untuk membuat atau memperbarui sesi pembacaan dan ringkasan hariannya.
   */
  public override async create(
    data: CreateReadingSessionInternal
  ): Promise<ReadingSession> {
    const { meter_id, reading_date, details, user_id } = data;

    const meter = await this._validateMeter(meter_id);
    const dateForDb = this._normalizeDate(reading_date);
    // Panggil validasi duplikat sebelum memulai transaksi
    await this._validateDuplicateReadings(meter_id, dateForDb, details);
    await this._validateReadingsAgainstPrevious(meter, dateForDb, details);

    const newSession = await this._handleCrudOperation(() =>
      this._prisma.$transaction(async (tx) => {
        const { sessionId } = await this._findOrCreateSession(
          tx,
          meter_id,
          dateForDb,
          user_id
        );
        await this._createReadingDetails(tx, sessionId, details);

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

    // Panggil logika summary terpusat SETELAH transaksi create session berhasil
    await this.processAndSummarizeReading(meter_id, dateForDb);

    // Setelah transaksi berhasil, kirim notifikasi ke semua admin
    const admins = await prisma.user.findMany({
      where: {
        role: {
          role_name: {
            in: [RoleName.Admin, RoleName.SuperAdmin],
          },
        },
        is_active: true,
      },
      select: {
        user_id: true,
      },
    });

    for (const admin of admins) {
      // PERBAIKAN: Gunakan NotificationService untuk membuat dan mengirim notifikasi
      await notificationService.create({
        user_id: admin.user_id,
        title: 'Data Reading Baru',
        message: `Data baru untuk meteran ${
          newSession.meter.meter_code
        } pada tanggal ${dateForDb.toLocaleDateString()} telah diinput oleh ${
          newSession.user.username
        }.`,
      });
    }

    return newSession;
  }

  /**
   * BARU: Metode publik untuk memproses dan membuat ringkasan untuk satu meter pada tanggal tertentu.
   * Ini adalah inti logika yang diekstrak dari `create` dan `recalculate` untuk reusability.
   * @param meterId - ID meter yang akan diproses.
   * @param date - Tanggal pembacaan yang akan diproses.
   */
  public async processAndSummarizeReading(
    meterId: number,
    date: Date
  ): Promise<void> {
    return this._handleCrudOperation(async () => {
      const meter = await this._prisma.meter.findUniqueOrThrow({
        where: { meter_id: meterId },
        // PERBAIKAN: Sertakan semua relasi yang dibutuhkan oleh _updateDailySummary
        // agar tidak perlu query ulang dan menghindari error.
        include: {
          energy_type: true,
          category: true,
          tariff_group: {
            include: {
              price_schemes: {
                include: { rates: true, taxes: { include: { tax: true } } },
              },
            },
          },
        },
      });

      const dateForDb = this._normalizeDate(date);

      // Jalankan logika pembaruan summary di dalam transaksi
      await this._prisma.$transaction(async (tx) => {
        await this._updateDailySummary(tx, meter, dateForDb);
      });
    });
  }

  /**
   * Menghapus sesi pembacaan beserta ringkasan harian yang terkait.
   * Operasi ini dibungkus dalam transaksi untuk memastikan konsistensi data.
   * @param sessionId - ID dari ReadingSession yang akan dihapus.
   * @returns ReadingSession yang telah dihapus.
   */
  public override async delete(sessionId: number): Promise<ReadingSession> {
    return this._handleCrudOperation(() =>
      this._prisma.$transaction(async (tx) => {
        // 1. Ambil data sesi yang akan dihapus untuk mendapatkan meter_id dan reading_date
        const sessionToDelete = await tx.readingSession.findUnique({
          where: { session_id: sessionId },
          select: { meter_id: true, reading_date: true },
        });

        if (!sessionToDelete) {
          throw new Error404(
            `Sesi pembacaan dengan ID ${sessionId} tidak ditemukan.`
          );
        }

        const { meter_id, reading_date } = sessionToDelete;

        // 2. Hapus DailySummary yang terkait (ini akan otomatis menghapus SummaryDetail karena onDelete: Cascade)
        await tx.dailySummary.deleteMany({
          where: {
            meter_id,
            summary_date: reading_date,
          },
        });

        // BARU: Hapus juga DailyLogbook yang terkait dengan meter dan tanggal yang sama.
        await tx.dailyLogbook.deleteMany({
          where: {
            meter_id,
            log_date: reading_date,
          },
        });

        // 3. Hapus ReadingSession (ini akan otomatis menghapus ReadingDetail karena onDelete: Cascade)
        const deletedSession = await tx.readingSession.delete({
          where: { session_id: sessionId },
        });

        return deletedSession;
      })
    );
  }

  // =============================================
  // LOGIKA INTI: PEMBUATAN SUMMARY
  // =============================================

  /**
   * Orkestrator untuk memperbarui DailySummary.
   * Mengambil data, memanggil kalkulator, dan menulis hasilnya ke DB.
   */
  private async _updateDailySummary(
    tx: Prisma.TransactionClient,
    meter: MeterWithRelations,
    dateForDb: Date
  ) {
    const currentSession = await tx.readingSession.findUnique({
      where: {
        unique_meter_reading_per_day: {
          reading_date: dateForDb,
          meter_id: meter.meter_id,
        },
      },
      include: { details: true },
    });

    if (!currentSession) return;

    // MODIFIKASI: Cari data spesifik dari H-1, bukan data terakhir yang ada.
    const previousDate = new Date(dateForDb);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);

    const previousSession = await tx.readingSession.findUnique({
      where: {
        unique_meter_reading_per_day: {
          reading_date: previousDate,
          meter_id: meter.meter_id,
        },
      },
      include: { details: true },
    });

    // LANGKAH 1: Hitung semua data detail yang akan dibuat
    const summaryDetailsToCreate = await this._calculateSummaryDetails(
      tx,
      meter,
      currentSession,
      previousSession
    );
    if (summaryDetailsToCreate.length === 0) return;

    // LANGKAH 2: Jumlahkan 'consumption_cost' dari semua detail untuk mendapatkan 'total_cost'
    // PERBAIKAN: Hanya jumlahkan biaya dari metrik dasar, bukan dari metrik "Total Pemakaian"
    // untuk menghindari penghitungan ganda.
    const finalTotalCost = summaryDetailsToCreate.reduce(
      (sum, detail) =>
        detail.metric_name !== 'Total Pemakaian'
          ? sum.plus(detail.consumption_cost ?? 0)
          : sum,
      new Prisma.Decimal(0)
    );

    // PERBAIKAN: Hitung total konsumsi dari metrik utama.
    // Untuk Listrik, ini adalah 'Total Pemakaian'. Untuk lainnya, ini adalah satu-satunya metrik yang ada.
    const finalTotalConsumption = summaryDetailsToCreate.reduce(
      (sum, detail) =>
        !detail.metric_name.includes('WBP') &&
        !detail.metric_name.includes('LWBP')
          ? sum.plus(new Prisma.Decimal(detail.consumption_value ?? 0)) // Jumlahkan jika bukan komponen
          : sum,
      new Prisma.Decimal(0)
    );

    // LANGKAH 3: Buat atau perbarui 'DailySummary' dengan total biaya yang benar
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

    // LANGKAH 4: Hapus detail lama dan buat detail baru yang sudah dihitung
    await tx.summaryDetail.deleteMany({
      where: { summary_id: dailySummary.summary_id },
    });
    await tx.summaryDetail.createMany({
      data: summaryDetailsToCreate.map((detail) => ({
        ...detail,
        summary_id: dailySummary.summary_id,
      })),
    });

    // LANGKAH 5: Panggil logika klasifikasi setelah summary dibuat/diperbarui
    await this._classifyDailyUsage(tx, dailySummary, meter);

    // BARU: LANGKAH 6: Cek pemakaian terhadap target efisiensi dan kirim notifikasi jika melebihi
    await this._checkUsageAgainstTargetAndNotify(tx, dailySummary, meter);
  }

  private _normalizeDate(date: Date | string): Date {
    const localDate = new Date(date);
    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    const day = localDate.getDate();
    return new Date(Date.UTC(year, month, day));
  }

  /**
   * BARU: Memetakan hasil string dari model ML ke tipe enum UsageCategory.
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
    // Default ke NORMAL jika tidak cocok
    return UsageCategory.NORMAL;
  }

  /**
   * (DUMMY) Menerapkan logika untuk mengklasifikasikan penggunaan harian.
   * Di aplikasi nyata, di sinilah Anda akan memanggil model ML.
   */

  private async _classifyDailyUsage(
    tx: Prisma.TransactionClient,
    summary: Prisma.DailySummaryGetPayload<{}>,
    meter: MeterWithRelations
  ) {
    // PERBAIKAN: Ganti logika dummy dengan pemanggilan API ML.

    // 1. Kumpulkan data yang dibutuhkan oleh model klasifikasi.
    // Hanya berjalan jika tipe energi adalah Listrik.
    if (meter.energy_type.type_name !== 'Electricity') {
      return;
    }

    const todayDetails = await tx.summaryDetail.findMany({
      where: { summary_id: summary.summary_id },
    });

    const previousDate = new Date(summary.summary_date);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);

    const previousSummary = await tx.dailySummary.findFirst({
      where: { meter_id: meter.meter_id, summary_date: previousDate },
      include: { details: true },
    });

    const paxToday = await tx.paxData.findUnique({
      where: { data_date: summary.summary_date },
    });
    const paxYesterday = await tx.paxData.findUnique({
      where: { data_date: previousDate },
    });

    // Jika data hari sebelumnya tidak lengkap, kita tidak bisa melakukan klasifikasi.
    if (!previousSummary || !paxToday || !paxYesterday) {
      console.log(
        `[Classifier] Data tidak lengkap untuk klasifikasi tanggal ${
          summary.summary_date.toISOString().split('T')[0]
        }`
      );
      return;
    }

    const getKwhConsumption = (details: typeof todayDetails) => {
      const wbp =
        details.find((d) => d.metric_name === 'Pemakaian WBP')
          ?.consumption_value ?? new Prisma.Decimal(0);
      const lwbp =
        details.find((d) => d.metric_name === 'Pemakaian LWBP')
          ?.consumption_value ?? new Prisma.Decimal(0);
      // PERBAIKAN: Sesuai permintaan, gunakan total konsumsi sebelum dikali faktor_kali.
      return wbp.plus(lwbp).toNumber();
    };

    const kwhToday = getKwhConsumption(todayDetails);
    const kwhYesterday = getKwhConsumption(previousSummary.details);

    // 2. Panggil API ML
    const classificationResult =
      await machineLearningService.classifyDailyUsage({
        kwh_today: kwhToday,
        kwh_yesterday: kwhYesterday,
        pax_today: paxToday.total_pax,
        pax_yesterday: paxYesterday.total_pax,
      });

    if (!classificationResult) {
      console.error(
        '[Classifier] Gagal mendapatkan hasil klasifikasi dari ML API.'
      );
      return;
    }

    const { klasifikasi, input_data } = classificationResult;

    const usageCategory = this._mapClassificationToEnum(klasifikasi as string);

    // Buat atau perbarui data klasifikasi
    await tx.dailyUsageClassification.upsert({
      where: { summary_id: summary.summary_id },
      update: {
        classification: usageCategory,
        model_version: '1.1.0-prod', // Ganti dengan versi model Anda
        confidence_score: 0.95, // Ganti dengan skor dari model jika ada
        reasoning: `Klasifikasi berdasarkan perubahan kWh: ${input_data.perubahan_listrik_kwh} dan Pax: ${input_data.perubahan_pax}`,
      },
      create: {
        summary_id: summary.summary_id,
        meter_id: meter.meter_id,
        classification_date: summary.summary_date,
        classification: usageCategory,
        model_version: '1.1.0-prod',
        confidence_score: 0.95,
        reasoning: `Klasifikasi berdasarkan perubahan kWh: ${input_data.perubahan_listrik_kwh} dan Pax: ${input_data.perubahan_pax}`,
      },
    });

    // 3. Jika hasilnya "BOROS", buat alert dan kirim notifikasi.
    if (usageCategory === UsageCategory.BOROS) {
      const title = 'Peringatan: Terdeteksi Pemakaian Boros';
      const message = `Pemakaian listrik untuk meteran ${
        meter.meter_code
      } pada tanggal ${summary.summary_date.toLocaleDateString()} diklasifikasikan sebagai BOROS.`;

      // Kirim notifikasi ke semua admin
      const admins = await tx.user.findMany({
        where: {
          role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
        },
      });
      for (const admin of admins) {
        await notificationService.create({
          user_id: admin.user_id,
          title,
          message,
        });
      }
    }
  }

  /**
   * BARU: Memeriksa penggunaan harian terhadap target efisiensi.
   * Jika penggunaan melebihi target, kirim notifikasi ke admin.
   */
  private async _checkUsageAgainstTargetAndNotify(
    tx: Prisma.TransactionClient,
    summary: Prisma.DailySummaryGetPayload<{}>,
    meter: MeterWithRelations
  ) {
    // 1. Ambil target efisiensi untuk meter dan tanggal ini
    const target = await tx.efficiencyTarget.findFirst({
      where: {
        meter_id: meter.meter_id,
        period_start: { lte: summary.summary_date },
        period_end: { gte: summary.summary_date },
      },
    });

    // Jika tidak ada target untuk hari ini, hentikan proses.
    if (!target || target.target_value.isZero()) {
      return;
    }

    // 2. Ambil detail summary yang baru saja dibuat untuk mendapatkan total konsumsi
    const summaryDetails = await tx.summaryDetail.findMany({
      where: { summary_id: summary.summary_id },
    });

    if (summaryDetails.length === 0) {
      return;
    }

    // 3. Hitung total konsumsi
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

    // 4. Bandingkan konsumsi dengan target
    if (totalConsumption.greaterThan(target.target_value)) {
      // 5. Hitung persentase kelebihan
      const excess = totalConsumption.minus(target.target_value);
      const percentage = excess.div(target.target_value).times(100).toFixed(2);

      // 6. Kirim notifikasi ke semua admin & superadmin
      const admins = await tx.user.findMany({
        where: {
          role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
          is_active: true,
        },
        select: { user_id: true },
      });

      const message = `Pemakaian harian untuk meteran ${meter.meter_code} melebihi target sebesar ${percentage}%.`;
      const title = 'Peringatan: Target Efisiensi Terlampaui';

      for (const admin of admins) {
        // PERBAIKAN: Gunakan notificationService untuk konsistensi
        await notificationService.create({
          user_id: admin.user_id,
          title,
          message,
        });
      }
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
      // PERBAIKAN: Nama variabel lebih jelas
      tx,
      meter.tariff_group, // PERBAIKAN: Kirim seluruh objek tariff_group yang sudah di-load
      currentSession.reading_date
    );
    const summaryDetails: Omit<
      Prisma.SummaryDetailCreateInput,
      'summary' | 'summary_id'
    >[] = [];

    // --- LOGIKA UTAMA: Pisahkan berdasarkan jenis energi ---

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

    if (meter.energy_type.type_name === 'Fuel') {
      return this._calculateFuelSummary(
        tx,
        meter,
        currentSession,
        previousSession,
        activePriceScheme
      );
    }

    return summaryDetails;
  }

  // =============================================
  // KALKULATOR SPESIFIK PER JENIS ENERGI
  // =============================================

  private async _calculateElectricitySummary(
    tx: Prisma.TransactionClient,
    meter: MeterWithRelations,
    currentSession: SessionWithDetails,
    previousSession: SessionWithDetails | null,
    priceScheme: Prisma.PriceSchemeGetPayload<{
      include: { rates: true };
    }> | null
  ) {
    // PERBAIKAN: Validasi bahwa skema harga ada. Jika tidak, hentikan operasi.
    if (!priceScheme) {
      throw new Error404(
        `Konfigurasi harga untuk golongan tarif '${
          meter.tariff_group.group_code
        }' pada tanggal ${
          currentSession.reading_date.toISOString().split('T')[0]
        } tidak ditemukan.`
      );
    }

    const getDetailValue = (
      session: SessionWithDetails | null,
      typeId: number
    ) => session?.details.find((d) => d.reading_type_id === typeId)?.value;

    const faktorKali = new Prisma.Decimal(meter.tariff_group?.faktor_kali ?? 1);

    // Logika disatukan untuk semua meteran listrik (Terminal, Perkantoran, dll)
    const wbpType = await tx.readingType.findFirst({
      where: { type_name: 'WBP' },
    });
    const lwbpType = await tx.readingType.findFirst({
      where: { type_name: 'LWBP' },
    });
    if (!wbpType || !lwbpType) return [];

    const rateWbp = priceScheme.rates.find(
      (r) => r.reading_type_id === wbpType.reading_type_id
    );
    const rateLwbp = priceScheme.rates.find(
      (r) => r.reading_type_id === lwbpType.reading_type_id
    );

    // PERBAIKAN: Validasi bahwa tarif WBP dan LWBP ada dalam skema harga.
    if (!rateWbp || !rateLwbp) {
      throw new Error404(
        `Tarif WBP atau LWBP tidak terdefinisi dalam skema harga '${priceScheme.scheme_name}'.`
      );
    }

    const HARGA_WBP = new Prisma.Decimal(rateWbp.value);
    const HARGA_LWBP = new Prisma.Decimal(rateLwbp.value);

    const wbpConsumption = this._calculateSafeConsumption(
      getDetailValue(currentSession, wbpType.reading_type_id),
      getDetailValue(previousSession, wbpType.reading_type_id)
    );
    const lwbpConsumption = this._calculateSafeConsumption(
      getDetailValue(currentSession, lwbpType.reading_type_id),
      getDetailValue(previousSession, lwbpType.reading_type_id)
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

    // Tambahkan metrik "Total Pemakaian"
    summaryDetails.push({
      metric_name: 'Total Pemakaian',
      energy_type_id: meter.energy_type_id,
      current_reading: new Prisma.Decimal(0), // Tidak relevan untuk total
      previous_reading: new Prisma.Decimal(0), // Tidak relevan untuk total
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
    // PERBAIKAN: Validasi bahwa skema harga ada. Jika tidak, hentikan operasi.
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

    // PERBAIKAN: Validasi bahwa tarif ada dalam skema harga.
    if (!rate) {
      throw new Error404(
        `Tarif untuk '${mainType.type_name}' tidak terdefinisi dalam skema harga '${priceScheme.scheme_name}'.`
      );
    }
    const HARGA_SATUAN = new Prisma.Decimal(rate.value);
    const consumption = this._calculateSafeConsumption(
      getDetailValue(currentSession, mainType.reading_type_id),
      getDetailValue(previousSession, mainType.reading_type_id)
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
    // PERBAIKAN: Validasi bahwa skema harga ada. Jika tidak, hentikan operasi.
    if (!priceScheme) {
      throw new Error404(
        `Konfigurasi harga untuk golongan tarif '${
          meter.tariff_group.group_code
        }' pada tanggal ${
          currentSession.reading_date.toISOString().split('T')[0]
        } tidak ditemukan.`
      );
    }

    // Asumsi untuk BBM, tipe bacaannya adalah 'Ketinggian'
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

    // PERBAIKAN: Validasi bahwa tarif ada dalam skema harga.
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

    // Jika ada penambahan BBM, ketinggian akan naik. Jika pemakaian, ketinggian turun.
    // Kita asumsikan pembacaan adalah setelah pemakaian, jadi current < previous.
    // Jika current > previous, berarti ada pengisian, dan konsumsi untuk hari itu 0.
    const heightDifference = previousHeight.minus(currentHeight);
    const consumptionInLiters = heightDifference.isNegative()
      ? new Prisma.Decimal(0) // Ada pengisian, konsumsi = 0
      : heightDifference.times(LITERS_PER_CM);

    return [
      {
        metric_name: `Pemakaian Harian (${meter.energy_type.unit_of_measurement})`,
        energy_type_id: meter.energy_type_id,
        current_reading: currentHeight, // Catat ketinggian
        previous_reading: previousHeight, // Catat ketinggian sebelumnya
        consumption_value: consumptionInLiters, // Catat konsumsi dalam liter
        consumption_cost: consumptionInLiters.times(HARGA_SATUAN),
      },
    ];
  }

  // =============================================
  // METODE HELPER & CRUD LAINNYA
  // =============================================

  private async _getLatestPriceScheme(
    tx: Prisma.TransactionClient,
    tariffGroupOrId:
      | number
      | Prisma.TariffGroupGetPayload<{
          include: { price_schemes: { include: { rates: true; taxes: true } } };
        }>,
    date: Date
  ) {
    // PERBAIKAN: Buat fungsi ini lebih fleksibel.
    // Jika sudah diberi objek tariff_group dengan price_schemes, gunakan itu.
    // Jika hanya diberi ID, lakukan query seperti biasa.
    if (
      typeof tariffGroupOrId === 'object' &&
      'price_schemes' in tariffGroupOrId
    ) {
      // Jika objek lengkap diberikan (dari alur recalculate), cari dari data yang ada.
      return (
        tariffGroupOrId.price_schemes
          .filter((ps) => ps.effective_date <= date && ps.is_active)
          .sort(
            (a, b) => b.effective_date.getTime() - a.effective_date.getTime()
          )[0] || null
      );
    } else {
      // Jika hanya ID yang diberikan (dari alur create normal), lakukan query.
      return tx.priceScheme.findFirst({
        where: {
          tariff_group_id: tariffGroupOrId as number,
          effective_date: { lte: date },
          is_active: true,
        },
        orderBy: { effective_date: 'desc' },
        include: { rates: true, taxes: { include: { tax: true } } },
      });
    }
  }

  private _calculateSafeConsumption(
    currentValue?: Prisma.Decimal,
    previousValue?: Prisma.Decimal
  ): Prisma.Decimal {
    const current = currentValue ?? new Prisma.Decimal(0);
    const previous = previousValue ?? new Prisma.Decimal(0);
    if (current.lessThan(previous)) {
      return new Prisma.Decimal(0); // Meter direset, anggap konsumsi 0
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

  // Menghapus validasi < nilai sebelumnya, karena sudah ditangani di kalkulasi

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
          // MODIFIKASI: Cari data pada tanggal H-1 yang spesifik
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
      // LANGKAH 1: Membangun klausa 'where' secara dinamis
      const whereClause = this._buildWhereClause(
        energyTypeName,
        startDate,
        endDate,
        meterId
      );

      // LANGKAH 2: Membangun klausa 'orderBy' secara dinamis
      const orderByClause = this._buildOrderByClause(sortBy, sortOrder);

      // LANGKAH 3: Melakukan kueri ke basis data dengan klausa yang sudah dibangun
      const readingSessions = await this._prisma.readingSession.findMany({
        where: whereClause,
        include: {
          meter: {
            select: {
              meter_code: true,
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
              reading_type_id: 'asc', // Memastikan detail (WBP/LWBP) selalu dalam urutan yang sama
            },
          },
        },
        orderBy: orderByClause,
      });

      return {
        data: readingSessions,
        message: 'Successfully retrieved reading history.',
      };
    });
  }

  private _buildWhereClause(
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

    if (startDate && endDate) {
      where.reading_date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    return where;
  }

  /**
   * Metode private untuk membangun objek 'orderBy' Prisma secara dinamis.
   */
  private _buildOrderByClause(
    sortBy: 'reading_date' | 'created_at' = 'reading_date',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Prisma.ReadingSessionOrderByWithRelationInput {
    // Prisma mengharapkan objek di dalam array untuk orderBy
    const orderBy: Prisma.ReadingSessionOrderByWithRelationInput = {};

    if (sortBy === 'reading_date') {
      orderBy.reading_date = sortOrder;
    } else if (sortBy === 'created_at') {
      orderBy.created_at = sortOrder;
    }

    return orderBy;
  }
}

export const readingService = new ReadingService();
