import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../configs/db.js';
import { UsageCategory } from '../../generated/prisma/index.js';

// --- TYPE DEFINITIONS ---
export type MeterRankType = {
  code: string;
  consumption: number;
  budget: number;
  status: UsageCategory;
  unit_of_measurement: string;
};

export type EnergyOutlookType = {
  meter_code: string;
  est: number;
  status: UsageCategory;
  over: number;
};

export type YearlyHeatmapType = {
  classification_date: Date;
  classification: UsageCategory;
  confidence_score?: Decimal;
};

export type BudgetTrackingType = {
  year: string;
  energyType: string;
  initial: number;
  used: number[];
  saved: number[];
};

export type YearlyAnalysisType = {
  month: string;
  consumption: number;
  cost: number;
  budget: number;
};

export type UnifiedEnergyComparisonType = {
  category: string;
  unit: string;
  weekday_cons: number;
  holiday_cons: number;
  weekday_cost: number;
  holiday_cost: number;
};

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ags',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export type efficiencyRatioType = {
  day: string;
  terminalRatio: Decimal;
  officeRatio: Decimal;
  pax: number;
};

export type DailyAveragePaxType = { day: string; avgPax: number };

export type BudgetBurnRateType = {
  dayDate: number;
  actual: number;
  idea: number;
};

// --- SERVICES ---

export const MeterRankService = async (): Promise<MeterRankType[]> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const data = await prisma.meter.findMany({
      where: { status: 'Active' },
      select: {
        meter_code: true,
        energy_type: {
          select: {
            type_name: true,
            unit_of_measurement: true,
            reading_types: {
              select: { rates: { select: { value: true } } },
            },
          },
        },
        daily_summaries: {
          where: { summary_date: { gte: startOfMonth, lte: endOfMonth } },
          select: {
            total_consumption: true,
            classification: { select: { classification: true } },
          },
          orderBy: { summary_date: 'desc' },
        },
        budget_allocations: {
          select: {
            weight: true,
            budget: {
              select: {
                total_budget: true,
                period_start: true,
                period_end: true,
              },
            },
          },
          orderBy: { budget: { period_start: 'desc' } },
          take: 1,
        },
      },
    });

    const result = data.map((meter) => {
      const allRates =
        meter.energy_type?.reading_types.flatMap((rt) =>
          rt.rates.map((r) => new Decimal(r.value).toNumber())
        ) || [];

      const specificAvgRate =
        allRates.length > 0
          ? allRates.reduce((acc, curr) => acc + curr, 0) / allRates.length
          : 1500;

      const totalConsumptionMonth = meter.daily_summaries.reduce(
        (acc, curr) =>
          acc + new Decimal(curr.total_consumption ?? 0).toNumber(),
        0
      );

      const latestStatus =
        meter.daily_summaries[0]?.classification?.classification;
      const allocation = meter.budget_allocations[0];
      const budgetParent = allocation?.budget;
      let budgetInKwh = 0;

      if (budgetParent && allocation.weight) {
        const start = new Date(budgetParent.period_start);
        const end = new Date(budgetParent.period_end);
        const monthDuration =
          (end.getFullYear() - start.getFullYear()) * 12 +
            (end.getMonth() - start.getMonth()) || 1;

        const totalBudgetInRp = new Decimal(
          budgetParent.total_budget
        ).toNumber();
        const monthlyBudgetParent = totalBudgetInRp / monthDuration;
        const meterMonthlyBudgetRp =
          monthlyBudgetParent * new Decimal(allocation.weight).toNumber();

        budgetInKwh = meterMonthlyBudgetRp / specificAvgRate;
      }

      return {
        code: meter.meter_code,
        unit_of_measurement:
          meter.energy_type?.unit_of_measurement ?? 'UNKNOWN',
        consumption: totalConsumptionMonth,
        budget: Math.round(budgetInKwh),
        status: (latestStatus as UsageCategory) ?? 'UNKNOWN',
      };
    });

    return result.sort((a, b) => {
      const ratioA = a.budget > 0 ? a.consumption / a.budget : 0;
      const ratioB = b.budget > 0 ? b.consumption / b.budget : 0;
      return ratioB - ratioA;
    });
  } catch (error) {
    console.error('Error in MeterRankService:', error);
    throw new Error('Gagal mengambil data ranking meteran.');
  }
};

export const EnergyOutlookService = async (): Promise<EnergyOutlookType[]> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const predictionsSummary = await prisma.consumptionPrediction.groupBy({
      by: ['meter_id'],
      where: { prediction_date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { predicted_value: true },
    });

    const results = await Promise.all(
      predictionsSummary.map(async (p) => {
        const meterDetail = await prisma.meter.findUnique({
          where: { meter_id: p.meter_id },
          select: {
            meter_code: true,
            energy_type: {
              select: {
                reading_types: {
                  select: { rates: { select: { value: true } } },
                },
              },
            },
            budget_allocations: {
              select: {
                weight: true,
                budget: {
                  select: {
                    total_budget: true,
                    period_start: true,
                    period_end: true,
                  },
                },
              },
              take: 1,
              orderBy: { budget: { period_start: 'desc' } },
            },
            daily_summaries: {
              take: 1,
              orderBy: { summary_date: 'desc' },
              select: { classification: { select: { classification: true } } },
            },
          },
        });

        if (!meterDetail) return null;

        const allRates =
          meterDetail.energy_type?.reading_types.flatMap((rt) =>
            rt.rates.map((r) => new Decimal(r.value).toNumber())
          ) || [];

        const specificAvgRate =
          allRates.length > 0
            ? allRates.reduce((acc, curr) => acc + curr, 0) / allRates.length
            : 1500;

        const totalPredictedKwh = new Decimal(
          p._sum.predicted_value || 0
        ).toNumber();
        const estCost = totalPredictedKwh * specificAvgRate;

        let budgetKwh = 0;
        const allocation = meterDetail.budget_allocations[0];
        if (allocation?.budget) {
          const start = new Date(allocation.budget.period_start);
          const end = new Date(allocation.budget.period_end);
          const monthDuration =
            (end.getFullYear() - start.getFullYear()) * 12 +
              (end.getMonth() - start.getMonth()) || 1;

          const monthlyBudgetRp =
            new Decimal(allocation.budget.total_budget).toNumber() /
            monthDuration;
          const meterBudgetRp =
            monthlyBudgetRp * new Decimal(allocation.weight).toNumber();

          budgetKwh = meterBudgetRp / specificAvgRate;
        }

        const overPercentage =
          budgetKwh > 0 ? Math.round((totalPredictedKwh / budgetKwh) * 100) : 0;

        return {
          meter_code: meterDetail.meter_code,
          est: Math.round(estCost),
          status:
            (meterDetail.daily_summaries[0]?.classification
              ?.classification as UsageCategory) ?? 'NORMAL',
          over: overPercentage,
        };
      })
    );

    return results.filter((item) => item !== null) as EnergyOutlookType[];
  } catch (error) {
    console.error('Error in EnergyOutlookService:', error);
    throw new Error('Gagal mengagregasi data prediksi energi.');
  }
};

export const getYearlyHeatmapService = async (
  meterId: number,
  year: number
): Promise<YearlyHeatmapType[]> => {
  try {
    return await prisma.dailyUsageClassification.findMany({
      where: {
        meter_id: meterId,
        classification_date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
      select: {
        classification_date: true,
        classification: true,
        confidence_score: true,
      },
      orderBy: { classification_date: 'asc' },
    });
  } catch (error) {
    console.error('Error in getYearlyHeatmapService:', error);
    throw new Error('Gagal mengambil data heatmap tahunan.');
  }
};

export const getBudgetTrackingService = async (): Promise<
  BudgetTrackingType[]
> => {
  try {
    const budgets = await prisma.annualBudget.findMany({
      include: { energy_type: true },
      orderBy: { period_start: 'desc' },
    });

    const result = await Promise.all(
      budgets.map(async (budget) => {
        const year = budget.period_start.getFullYear().toString();
        const energyTypeName = budget.energy_type.type_name;
        const initialBudget = Number(budget.total_budget);

        const usageAggregates = await prisma.dailySummary.groupBy({
          by: ['summary_date'],
          _sum: { total_cost: true },
          where: {
            summary_date: {
              gte: new Date(`${year}-01-01`),
              lte: new Date(`${year}-12-31`),
            },
            meter: {
              energy_type: { type_name: energyTypeName },
            },
          },
        });

        const usedArray = new Array(12).fill(0);
        usageAggregates.forEach((record) => {
          const month = new Date(record.summary_date).getMonth();
          usedArray[month] += Number(record._sum.total_cost || 0);
        });

        const monthlyBudget = initialBudget / 12;
        const savedArray = usedArray.map((used) => {
          if (used === 0) return 0;
          return Math.max(0, monthlyBudget - used);
        });

        return {
          year: year,
          energyType: energyTypeName,
          initial: initialBudget,
          used: usedArray,
          saved: savedArray,
        };
      })
    );

    return result;
  } catch (error) {
    console.error('Error in getBudgetTrackingService:', error);
    throw new Error('Gagal melacak penggunaan anggaran.');
  }
};

export const getYearlyAnalysisService = async (
  energyTypeName: string,
  year: number
): Promise<YearlyAnalysisType[]> => {
  try {
    // 1. Fetch Semua Data Harian dalam range tahun tersebut
    const summaries = await prisma.dailySummary.findMany({
      where: {
        summary_date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
        meter: {
          energy_type: {
            type_name: energyTypeName,
          },
        },
      },
      select: {
        summary_date: true,
        total_consumption: true,
        total_cost: true,
      },
    });

    // 2. Fetch Budget Tahunan
    const budgetRecord = await prisma.annualBudget.findFirst({
      where: {
        period_start: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
        parent_budget_id: null,
        energy_type: {
          type_name: energyTypeName,
        },
      },
    });

    // Hitung Budget per Bulan (Rata-rata)
    const totalBudget = budgetRecord ? Number(budgetRecord.total_budget) : 0;
    const monthlyBudget = totalBudget / 12;

    // 3. Inisialisasi Wadah Data 12 Bulan
    const aggregatedData = Array.from({ length: 12 }, (_, index) => ({
      monthIndex: index,
      monthName: MONTH_NAMES[index],
      consumption: 0,
      cost: 0,
    }));

    // 4. Lakukan Agregasi
    for (const item of summaries) {
      const date = new Date(item.summary_date);
      const monthIndex = date.getMonth();

      if (aggregatedData[monthIndex]) {
        aggregatedData[monthIndex].consumption += Number(
          item.total_consumption
        );
        aggregatedData[monthIndex].cost += Number(item.total_cost);
      }
    }

    // 5. Format Return
    const result: YearlyAnalysisType[] = aggregatedData.map((data) => ({
      month: data.monthName,
      consumption: data.consumption,
      cost: data.cost,
      budget: monthlyBudget,
    }));

    return result;
  } catch (error) {
    console.error('Error in getYearlyAnalysisService:', error);
    throw new Error('Gagal menganalisis tren tahunan.');
  }
};

export const getUnifiedComparisonService = async (
  energyTypeName: string,
  year: number,
  month: number // <--- 1. Tambahkan parameter Month (1 - 12)
): Promise<UnifiedEnergyComparisonType> => {
  try {
    const startDate = new Date(year, month - 1, 1); // Tgl 1 bulan tsb
    const endDate = new Date(year, month, 0, 23, 59, 59); // Tgl terakhir (28/29/30/31) jam 23:59

    // 3. Ambil data harian (Filter gte startDate & lte endDate)
    const summaries = await prisma.dailySummary.findMany({
      where: {
        summary_date: {
          gte: startDate,
          lte: endDate,
        },
        meter: {
          energy_type: { type_name: energyTypeName },
        },
      },
      select: {
        summary_date: true,
        total_consumption: true,
        total_cost: true,
      },
    });

    // 4. Inisialisasi Akumulator
    let weekdayTotalCons = 0;
    let weekdayTotalCost = 0;
    let weekdayCount = 0;

    let holidayTotalCons = 0;
    let holidayTotalCost = 0;
    let holidayCount = 0;

    // 5. Unit Mapping
    const unitMap: Record<string, 'kWh' | 'm³' | 'L' | 'Unit'> = {
      Electricity: 'kWh',
      Water: 'm³',
      Fuel: 'L',
    };
    const unit = unitMap[energyTypeName] || 'Unit';

    // 6. Iterasi Data
    for (const item of summaries) {
      const date = new Date(item.summary_date);
      const day = date.getDay(); // 0 = Minggu, 6 = Sabtu

      // LOGIC SEDERHANA: Sabtu & Minggu = Libur
      const isHoliday = day === 0 || day === 6;

      const cons = Number(item.total_consumption);
      const cost = Number(item.total_cost);

      if (isHoliday) {
        holidayTotalCons += cons;
        holidayTotalCost += cost;
        holidayCount++;
      } else {
        weekdayTotalCons += cons;
        weekdayTotalCost += cost;
        weekdayCount++;
      }
    }

    // 7. Hitung Rata-rata
    const avgWeekdayCons =
      weekdayCount > 0 ? weekdayTotalCons / weekdayCount : 0;
    const avgHolidayCons =
      holidayCount > 0 ? holidayTotalCons / holidayCount : 0;
    const avgWeekdayCost =
      weekdayCount > 0 ? weekdayTotalCost / weekdayCount : 0;
    const avgHolidayCost =
      holidayCount > 0 ? holidayTotalCost / holidayCount : 0;

    return {
      category: energyTypeName as any,
      unit: unit,
      weekday_cons: Math.round(avgWeekdayCons),
      holiday_cons: Math.round(avgHolidayCons),
      weekday_cost: Math.round(avgWeekdayCost),
      holiday_cost: Math.round(avgHolidayCost),
    };
  } catch (error) {
    console.error('Error in getUnifiedComparisonService:', error);
    throw new Error('Gagal membandingkan data Workday vs Holiday.');
  }
};

export const getEfficiencyRatioService = async (
  year: number,
  month: number
): Promise<efficiencyRatioType[]> => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // --- 1. SIAPKAN BUCKET 7 HARI (Minggu - Sabtu) ---
    // Index 0 = Minggu, 1 = Senin, dst.
    const dayBuckets: Record<
      number,
      {
        name: string;
        totalPax: number;
        totalTerminal: number;
        totalOffice: number;
        occurrenceCount: number; // Berapa kali hari ini muncul dalam bulan tsb
      }
    > = {
      0: {
        name: 'Minggu',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      1: {
        name: 'Senin',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      2: {
        name: 'Selasa',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      3: {
        name: 'Rabu',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      4: {
        name: 'Kamis',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      5: {
        name: 'Jumat',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      6: {
        name: 'Sabtu',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
    };

    // --- 2. HITUNG JUMLAH HARI (Occurrence) ---
    // Contoh: Di bulan Oktober, hari Senin muncul 5 kali, Selasa 4 kali, dst.
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dayIndex = d.getDay();
      dayBuckets[dayIndex].occurrenceCount += 1;
    }

    // --- 3. FETCH & ISI DATA PAX ---
    const paxDataList = await prisma.paxData.findMany({
      where: { data_date: { gte: startDate, lte: endDate } },
    });

    paxDataList.forEach((p) => {
      const dayIndex = new Date(p.data_date).getDay();
      dayBuckets[dayIndex].totalPax += p.total_pax;
    });

    // --- 4. FETCH & ISI DATA KONSUMSI ---
    const summaries = await prisma.dailySummary.findMany({
      where: {
        summary_date: { gte: startDate, lte: endDate },
        meter: {
          status: 'Active',
          energy_type: {
            type_name: { contains: 'Electricity', mode: 'insensitive' },
          },
        },
      },
      include: {
        meter: { include: { category: true } },
      },
    });

    for (const item of summaries) {
      const dayIndex = new Date(item.summary_date).getDay();
      const kwh = Number(item.total_consumption);

      // Cek Kategori Terminal vs Office
      const categoryName = item.meter.category?.name?.toLowerCase() || '';
      const meterName = item.meter.meter_code.toLowerCase();
      const isOffice =
        categoryName.includes('office') ||
        meterName.includes('office') ||
        meterName.includes('kantor');

      if (isOffice) {
        dayBuckets[dayIndex].totalOffice += kwh;
      } else {
        dayBuckets[dayIndex].totalTerminal += kwh;
      }
    }

    // --- 5. HITUNG RATA-RATA & FORMAT HASIL ---
    // Kita ingin urutan output: Senin, Selasa, ..., Minggu (Sesuai kebiasaan kerja)
    const orderOfDay = [1, 2, 3, 4, 5, 6, 0]; // 1=Senin ... 0=Minggu

    const results = orderOfDay.map((dayIndex) => {
      const bucket = dayBuckets[dayIndex];

      // A. TERMINAL RATIO (kWh / Pax)
      // Rumus: Total Energi Hari X / Total Penumpang Hari X
      const terminalRatioVal =
        bucket.totalPax > 0 ? bucket.totalTerminal / bucket.totalPax : 0;

      // B. OFFICE RATIO (Rata-rata kWh per Hari)
      // Rumus: Total Energi Hari X / Berapa kali Hari X muncul
      // Contoh: Total Senin 5000 kWh dibagi 4 kali hari Senin = 1250 kWh/hari
      const officeRatioVal =
        bucket.occurrenceCount > 0
          ? bucket.totalOffice / bucket.occurrenceCount
          : 0;

      // C. Rata-rata Pax (Untuk Info Visual)
      const avgPax =
        bucket.occurrenceCount > 0
          ? Math.round(bucket.totalPax / bucket.occurrenceCount)
          : 0;

      return {
        day: bucket.name, // "Senin", "Selasa", dll
        pax: avgPax, // Rata-rata penumpang di hari tersebut
        terminalRatio: new Decimal(terminalRatioVal), // kWh per Pax
        officeRatio: new Decimal(officeRatioVal), // Rata-rata kWh Consumption
      };
    });

    return results;
  } catch (error) {
    console.error('Error in getEfficiencyRatioService:', error);
    throw new Error('Gagal menghitung profil efisiensi mingguan.');
  }
};

export const getDailyAveragePaxService = async (
  year: number,
  month: number
): Promise<DailyAveragePaxType[]> => {
  try {
    // 1. Tentukan Range Tanggal
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 2. Ambil Data Pax dalam range tersebut
    const paxDataList = await prisma.paxData.findMany({
      where: {
        data_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        data_date: true,
        total_pax: true,
      },
    });

    // 3. Siapkan Bucket untuk 7 Hari (Minggu - Sabtu)
    // Index: 0=Minggu, 1=Senin, ..., 6=Sabtu
    const dayBuckets: Record<
      number,
      { total: number; count: number; name: string }
    > = {
      0: { total: 0, count: 0, name: 'Minggu' },
      1: { total: 0, count: 0, name: 'Senin' },
      2: { total: 0, count: 0, name: 'Selasa' },
      3: { total: 0, count: 0, name: 'Rabu' },
      4: { total: 0, count: 0, name: 'Kamis' },
      5: { total: 0, count: 0, name: 'Jumat' },
      6: { total: 0, count: 0, name: 'Sabtu' },
    };

    // 4. Agregasi Data
    paxDataList.forEach((item) => {
      const dayIndex = new Date(item.data_date).getDay();

      if (dayBuckets[dayIndex]) {
        dayBuckets[dayIndex].total += item.total_pax;
        dayBuckets[dayIndex].count += 1;
      }
    });

    // 5. Hitung Rata-rata & Format Return (Urutkan Senin - Minggu)
    const orderOfDay = [1, 2, 3, 4, 5, 6, 0]; // 1=Senin ... 0=Minggu

    const results = orderOfDay.map((dayIndex) => {
      const bucket = dayBuckets[dayIndex];

      // Hitung rata-rata: Total Pax / Jumlah Hari kejadian
      // Contoh: Total 50.000 pax dibagi 4 hari Senin = 12.500
      const average = bucket.count > 0 ? bucket.total / bucket.count : 0;

      return {
        day: bucket.name,
        avgPax: Math.round(average), // Bulatkan ke angka bulat terdekat
      };
    });

    return results;
  } catch (error) {
    console.error('Error in getDailyAveragePaxService:', error);
    throw new Error('Gagal menghitung rata-rata penumpang harian.');
  }
};

export const BudgetBurnRateService = async (
  year: number,
  month: number
): Promise<BudgetBurnRateType[]> => {
  try {
  } catch (error) {}
};
