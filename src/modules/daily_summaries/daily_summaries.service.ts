/* eslint-disable no-console */
import prisma from '../../configs/db.js';
import { handlePrismaError } from '../../common/utils/prismaError.js';
import type { DailySummaryQuery } from './daily_summaries.type.js';
import type { Prisma } from '../../generated/prisma/index.js';
import { endOfDay, startOfDay } from 'date-fns';

export interface RecapQuery {
  energyType?: string;
  startDate?: string;
  endDate?: string;
  meterId?: string | number;
}
export const dailySummaryService = {
  show: async (query: DailySummaryQuery) => {
    try {
      const { meter_id, from_date, to_date, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.DailySummaryWhereInput = {};
      if (meter_id) where.meter_id = meter_id;

      if (from_date || to_date) {
        where.summary_date = {
          gte: from_date ? new Date(from_date) : undefined,
          lte: to_date ? new Date(to_date) : undefined,
        };
      }

      const [data, total] = await Promise.all([
        prisma.dailySummary.findMany({
          where,
          skip,
          take: limit,
          orderBy: { summary_date: 'desc' },
          include: {
            summary_details: true,
            meter: { select: { name: true, meter_code: true } },
          },
        }),
        prisma.dailySummary.count({ where }),
      ]);

      return {
        data,
        meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      return handlePrismaError(error, 'Daily Summary');
    }
  },
  getRecapData: async (query: RecapQuery) => {
    try {
      const { energyType, startDate, endDate, meterId } = query;

      // ==========================================
      // 1. SUSUN KONDISI FILTER (WHERE CLAUSE)
      // ==========================================
      const where: Prisma.DailySummaryWhereInput = {};

      if (startDate && endDate) {
        where.summary_date = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      }

      if (meterId && meterId !== 'all') {
        where.meter_id = Number(meterId);
      }

      if (energyType && energyType !== 'all') {
        where.meter = {
          energy_type: { name: energyType },
        };
      }

      // ==========================================
      // 2. QUERY KE DATABASE DENGAN RELASI LENGKAP
      // ==========================================
      const summaries = await prisma.dailySummary.findMany({
        where,
        orderBy: { summary_date: 'asc' },
        include: {
          meter: {
            select: { name: true, meter_code: true, location_id: true },
          },
          summary_details: true,
          ml_classifications: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

      // ==========================================
      // 3. BULK QUERY (PAX DATA & EFFICIENCY TARGET)
      // ==========================================

      // A. Setup untuk Pax Data (DIUBAH: Hiraukan Lokasi, fokus pada Tanggal)
      const dates = [...new Set(summaries.map((s) => s.summary_date))];
      const paxMap = new Map<string, number>(); // Key sekarang HANYA string tanggal

      if (dates.length > 0) {
        const paxRecords = await prisma.paxData.findMany({
          where: {
            date: { in: dates },
          },
        });

        paxRecords.forEach((pax) => {
          const dateStr = pax.date.toISOString().split('T')[0];

          // Jumlahkan semua pax di tanggal yang sama tanpa peduli lokasinya
          const existingCount = paxMap.get(dateStr) ?? 0;
          paxMap.set(dateStr, existingCount + pax.pax_count);
        });
      }

      // B. Setup untuk Efficiency Target
      const meterIds = [...new Set(summaries.map((s) => s.meter_id))];

      // Ambil semua target untuk meteran terkait
      const efficiencyTargets = await prisma.efficiencyTarget.findMany({
        where: { meter_id: { in: meterIds } },
      });

      // C. Setup untuk ML Prediction Data
      const mlPredictions = await prisma.mlPrediction.findMany({
        where: {
          meter_id: { in: meterIds },
          target_date: { in: dates },
        },
      });

      const predictionMap = new Map<string, number>();
      mlPredictions.forEach((p) => {
        const dStr = p.target_date.toISOString().split('T')[0];
        const key = `${p.meter_id}_${dStr}`;
        predictionMap.set(key, Number(p.predicted_value));
      });

      // ==========================================
      // 4. VARIABLES UNTUK DATA AGGREGATION (META)
      // ==========================================
      let totalCost = 0;
      let totalConsumption = 0;
      const columnTotals: Record<string, number> = {};

      // ==========================================
      // 5. DATA TRANSFORMATION & PIVOTING
      // ==========================================
      const data = summaries.map((summary) => {
        const cost = Number(summary.total_cost) || 0;
        const consumption = Number(summary.total_usage) || 0;

        totalCost += cost;
        totalConsumption += consumption;

        // A. Pivot summary_details
        const details: Record<string, number> = {};
        summary.summary_details.forEach((detail) => {
          const key = detail.label.toLowerCase().trim();
          const val = Number(detail.value) || 0;
          details[key] = val;

          // 👉 PERBAIKAN 1: Jangan jumlahkan field yang mengandung kata "suhu" ke dalam Akumulasi Total
          if (!key.includes('suhu') && key !== 'hari kerja') {
            columnTotals[key] = (columnTotals[key] || 0) + val;
          }
        });

        // B. Ekstrak data ML
        const ml = summary.ml_classifications?.[0];

        // C. Ekstrak Pax Data dari Map
        const dateStr = summary.summary_date.toISOString().split('T')[0];
        const paxCount = paxMap.get(dateStr) ?? 0;

        columnTotals.pax = (columnTotals.pax ?? 0) + paxCount;

        // D. Ekstrak Target Efisiensi
        const summaryTime = summary.summary_date.getTime();

        // Cari target yang masa berlakunya mencakup tanggal summary harian ini
        const activeTarget = efficiencyTargets.find(
          (t) =>
            t.meter_id === summary.meter_id &&
            summaryTime >= t.period_start.getTime() &&
            summaryTime <= t.period_end.getTime(),
        );

        // Gunakan baseline_value sebagai Target (sesuaikan jika rumusnya berbeda)
        const targetValue = activeTarget ? Number(activeTarget.baseline_value) : null;

        if (targetValue !== null) {
          columnTotals.target = (columnTotals.target ?? 0) + targetValue;
        }

        // E. Logika Hari Kerja
        const dayOfWeek = summary.summary_date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const hariKerja = isWeekend ? 'Libur' : 'Kerja';

        // F. Ekstrak Nilai Prediksi ML
        const predKey = `${summary.meter_id}_${dateStr}`;
        const predictedVal = predictionMap.get(predKey) ?? details.prediction ?? null;

        return {
          id: summary.summary_id,
          meter_id: summary.meter_id,
          date: summary.summary_date,
          cost,
          consumption,
          meter: {
            name: summary.meter.name,
            meter_code: summary.meter.meter_code,
          },
          hari_kerja: hariKerja,

          // 👉 PERBAIKAN 2: Tangkap 2 parameter suhu (Rata-rata & Max) secara terpisah
          suhu_rata_rata:
            details['suhu rata-rata'] ?? details['suhu rata rata'] ?? details.suhu ?? null,
          suhu_max: details['suhu max'] ?? details['suhu maksimal'] ?? null,

          ...details,

          // Sisipkan data eksternal
          pax: paxCount,
          target: targetValue, // Outputkan target ke FE

          classification: ml?.label || 'UNKNOWN',
          confidence_score:
            ml?.deviation_percent !== null && ml?.deviation_percent !== undefined
              ? Number(ml.deviation_percent)
              : null,
          prediction: predictedVal,
        };
      });

      return {
        data,
        meta: {
          total_rows: data.length,
          total_cost: totalCost,
          total_consumption: totalConsumption,
          column_totals: columnTotals,
        },
      };
    } catch (error) {
      console.error('🔥 ERROR PRISMA RECAP SERVICE:', error);
      return handlePrismaError(error, 'Recap Data Service');
    }
  },
};

export const getDayType = (date: Date): 'WORKDAY' | 'HOLIDAY' => {
  const day = date.getDay();
  // Dalam JavaScript: 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const isWeekend = day === 0 || day === 6;

  return isWeekend ? 'HOLIDAY' : 'WORKDAY';
};

export interface TemperatureData {
  avg: number;
  max: number;
}

export const fetchTodayTemperature = async (
  weatherConfig: any,
): Promise<TemperatureData | null> => {
  try {
    // 1. Format URL
    const weatherUrl = `${weatherConfig.baseURL}?lat=${weatherConfig.latitude}&lon=${weatherConfig.longitude}&appid=${weatherConfig.apiKey}&units=metric`;

    // 🔎 DEBUG: Lihat URL yang sebenarnya dipanggil.
    console.log(`[Cuaca] Memanggil API: ${weatherUrl}`);

    // 2. Eksekusi Fetch
    const res = await fetch(weatherUrl);

    // 3. Cek Status HTTP
    if (!res.ok) {
      console.warn(`[Cuaca] API merespons dengan error: ${res.status} ${res.statusText}`);
      return null;
    }

    // 4. Ekstrak JSON
    const data = await res.json();

    if (!data?.list || data.list.length === 0) {
      return null;
    }

    // 5. Kalkulasi Suhu Rata-rata dan Max HARI INI
    // Ambil tanggal dari item pertama (YYYY-MM-DD) sebagai acuan "hari ini"
    const todayStr = data.list[0].dt_txt.split(' ')[0];

    // Filter array list hanya untuk tanggal hari ini
    const todayForecasts = data.list.filter((item: any) => item.dt_txt.startsWith(todayStr));

    let sumTemp = 0;
    let maxTemp = -Infinity;

    todayForecasts.forEach((item: any) => {
      sumTemp += item.main.temp;
      if (item.main.temp_max > maxTemp) {
        maxTemp = item.main.temp_max;
      }
    });

    // Hitung rata-rata dan bulatkan 2 desimal
    const avgTemp = Number((sumTemp / todayForecasts.length).toFixed(2));

    // Kembalikan sebagai Objek
    return {
      avg: avgTemp,
      max: maxTemp !== -Infinity ? Number(maxTemp.toFixed(2)) : avgTemp,
    };
  } catch (err: any) {
    // Tangkap error jaringan
    console.error('[Cuaca] Gagal melakukan request:', err.message);
    return null;
  }
};

export const calculateDailyCost = async (
  meterId: number,
  targetDate: Date,
  tx: Prisma.TransactionClient,
  summaryDetails?: { label: string; value: number }[],
) => {
  console.log(`\n=== 🔎 DEBUG START: calculateDailyCost [Meter ID: ${meterId}] ===`);
  console.log(`📍 Target Date Asli:`, targetDate);

  // ==========================================
  // 1. VALIDASI SKEMA HARGA & TANGGAL EFEKTIF
  // (Include reading_type dan scheme_rates agar relasinya terbaca)
  // ==========================================
  const meter = await tx.meter.findUnique({
    where: { meter_id: meterId },
    include: {
      price_scheme: {
        include: {
          rates: {
            include: { reading_type: true }, // Tarik nama jenis pembacaan (WBP/LWBP)
          },
        },
      },
    },
  });

  if (!meter) {
    console.log(`❌ GAGAL 1: Meter dengan ID ${meterId} tidak ditemukan di database.`);
    return { date: targetDate, total_cost: 0, breakdown: [] };
  }

  if (!meter.price_scheme) {
    console.log(`❌ GAGAL 1: Meter ${meterId} TIDAK memiliki price_scheme yang terpasang.`);
    return { date: targetDate, total_cost: 0, breakdown: [] };
  }

  const scheme = meter.price_scheme;
  console.log(`✅ Skema Ditemukan: ${scheme.name} (Active: ${scheme.is_active})`);

  const targetDay = startOfDay(targetDate);
  const effectiveDay = startOfDay(scheme.effective_date);

  if (!scheme.is_active || effectiveDay > targetDay) {
    console.log(`❌ GAGAL 2: Skema harga tidak aktif atau belum berlaku.`);
    return { date: targetDate, total_cost: 0, breakdown: [] };
  }

  // ==========================================
  // 2. AMBIL SESI HARI INI & KEMARIN (Termasuk Detail & ReadingType)
  // ==========================================
  const rangeStart = targetDay;
  const rangeEnd = endOfDay(targetDate);

  const session = await tx.readingSession.findFirst({
    where: {
      meter_id: meterId,
      reading_date: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      details: {
        include: { reading_type: true }, // Agar tahu nama shift atau tipe pembacaannya
      },
    },
  });

  if (!session || session.details.length === 0) {
    console.log(`❌ GAGAL 3: Sesi pembacaan hari ini kosong atau tidak ditemukan.`);
    return { date: targetDate, total_cost: 0, breakdown: [] };
  }

  const prevSession = await tx.readingSession.findFirst({
    where: {
      meter_id: meterId,
      reading_date: { lt: targetDay },
    },
    orderBy: { reading_date: 'desc' },
    include: {
      details: {
        include: { reading_type: true },
      },
    },
  });

  // ==========================================
  // 3. HELPER: MAPPING SHIFT KE KATEGORI TARIF UTAMA
  // ==========================================
  // Sesuaikan fungsi ini dengan aturan bisnis gedung/pabrik Anda:
  const resolveTariffCategory = (typeName: string): string => {
    const upperName = typeName.toUpperCase();

    // Jika tipe secara eksplisit adalah LWBP atau KVARH
    if (upperName.includes('LWBP')) return 'LWBP';
    if (upperName.includes('KVARH')) return 'KVARH';

    // Jika shift mengandung kata malam/sore, atau secara eksplisit WBP
    if (upperName.includes('MALAM') || upperName.includes('SORE') || upperName.includes('WBP')) {
      return 'WBP';
    }

    return 'LWBP'; // Pagi, Siang, atau shift umum masuk ke LWBP
  };

  // ==========================================
  // 4. AGREGASI PEMAKAIAN BERDASARKAN KATEGORI TARIF
  // ==========================================
  const aggregatedUsage: Record<
    string,
    { usage: number; rate: number; reading_type_ids: number[] }
  > = {};

  // Cek apakah formulaEngine sudah menghitung pemakaian (WBP/LWBP)
  let usedFormula = false;
  if (summaryDetails && summaryDetails.length > 0) {
    const wbpItem = summaryDetails.find(d => d.label.toUpperCase() === 'PEMAKAIAN WBP' || d.label.toUpperCase() === 'WBP');
    const lwbpItem = summaryDetails.find(d => d.label.toUpperCase() === 'PEMAKAIAN LWBP' || d.label.toUpperCase() === 'LWBP');

    if (wbpItem || lwbpItem) {
      usedFormula = true;
      console.log(`✅ Menggunakan hasil kalkulasi formulaEngine untuk perhitungan biaya!`);

      const rateWBP = scheme.rates.find(r => r.reading_type?.type_name?.toUpperCase() === 'WBP');
      const rateLWBP = scheme.rates.find(r => r.reading_type?.type_name?.toUpperCase() === 'LWBP');

      if (wbpItem && rateWBP) {
        aggregatedUsage['WBP'] = {
          usage: wbpItem.value,
          rate: Number(rateWBP.rate_value),
          reading_type_ids: [],
        };
      }

      if (lwbpItem && rateLWBP) {
        aggregatedUsage['LWBP'] = {
          usage: lwbpItem.value,
          rate: Number(rateLWBP.rate_value),
          reading_type_ids: [],
        };
      }
    }
  }

  // Jika tidak menggunakan formula, lakukan perhitungan manual per shift
  if (!usedFormula) {
    for (const detail of session.details) {
      const typeName = detail.reading_type?.type_name ?? '';
      console.log(
        `\n   ➔ Memproses Shift/Tipe: ${typeName} (ID: ${detail.reading_type_id}) | Nilai input: ${Number(detail.value)}`,
      );

      const currentStand = Number(detail.value);
      const lastDet = prevSession?.details.find((d) => d.reading_type_id === detail.reading_type_id);
      let rawUsage = 0;
      if (lastDet) {
        const previousStand = Number(lastDet.value);
        rawUsage = currentStand - previousStand;
        if (rawUsage < 0) {
          console.log(`   ⚠️ Pemakaian minus (${rawUsage}). Anggap sebagai meteran baru/rollover.`);
          rawUsage = currentStand;
        }
      } else {
        console.log(
          `⚠️ Data sebelumnya tidak ditemukan untuk tipe ID ${detail.reading_type_id}. Set pemakaian 0.`,
        );
        rawUsage = 0;
      }

      // Terapkan faktor pengali (multiplier) dari meter
      const multiplier = meter.multiplier ? Number(meter.multiplier) : 1;
      const usage = rawUsage * multiplier;

      // Tentukan apakah masuk kelompok WBP atau LWBP
      const tariffCategory = resolveTariffCategory(typeName);
      console.log(`   🔀 Dipetakan ke Kategori Tarif: ${tariffCategory} (Pemakaian: ${usage})`);

      // Cari rate yang cocok di dalam skema harga berdasarkan kategori tarif tersebut
      const matchingRate = scheme.rates.find(
        (rate) => rate.reading_type?.type_name?.toUpperCase() === tariffCategory,
      );

      if (!matchingRate) {
        console.log(`   ❌ Rate untuk kategori ${tariffCategory} tidak ditemukan di skema harga!`);
        continue;
      }

      // Akumulasikan pemakaian jika ada beberapa shift yang masuk kategori sama (misal Pagi & Siang)
      if (!aggregatedUsage[tariffCategory]) {
        aggregatedUsage[tariffCategory] = {
          usage: 0,
          rate: Number(matchingRate.rate_value),
          reading_type_ids: [],
        };
      }

      aggregatedUsage[tariffCategory].usage += usage;
      aggregatedUsage[tariffCategory].reading_type_ids.push(detail.reading_type_id);
    }
  }

  // ==========================================
  // 5. HITUNG TOTAL BIAYA AKHIR DARI HASIL AGREGASI
  // ==========================================
  let totalCost = 0;
  const costDetails: any[] = [];

  for (const [category, data] of Object.entries(aggregatedUsage)) {
    const cost = data.usage * data.rate;
    totalCost += cost;

    console.log(
      `   💰 Kategori ${category}: Total Pemakaian ${data.usage} x Rate ${data.rate} = Rp ${cost}`,
    );

    costDetails.push({
      category,
      consumption_value: data.usage,
      rate_applied: data.rate,
      cost,
    });
  }

  console.log(`\n=== 💰 FINAL TOTAL COST: Rp ${totalCost} ===\n`);

  return {
    date: targetDate,
    total_cost: totalCost,
    breakdown: costDetails,
  };
};
