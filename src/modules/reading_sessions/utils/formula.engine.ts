import { Parser } from 'expr-eval';
import { Prisma } from '../../../generated/prisma/index.js';
import { format, subDays, addDays, startOfDay, endOfDay } from 'date-fns';
import {
  calculateDailyCost,
  fetchTodayTemperature,
  getDayType,
} from '../../daily_summaries/daily_summaries.service.js';
import { weatherConfig } from '../../../configs/weather.js';
import prisma from '../../../configs/db.js';

const parser = new Parser();

interface FormulaVariable {
  label: string;
  type: 'reading' | 'spec' | 'constant';
  readingTypeId?: number;
  timeShift?: number;
  specField?: string;
  meterId?: number;
}

interface FormulaItems {
  formula: string;
  variables: FormulaVariable[];
}

type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const toPrismaDate = (d: Date | string): Date => {
  const dateObj = new Date(d);
  return new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
};

type MeterWithTemplate = Prisma.MeterGetPayload<{
  include: {
    calculation_template: { include: { definitions: true } };
  };
}>;

export const formulaEngine = {
  async run(meterId: number, readingDate: Date, tx: TxClient) {
    const meter = await tx.meter.findUnique({
      where: { meter_id: meterId },
      include: {
        calculation_template: { include: { definitions: true } },
      },
    });

    if (meter?.calculation_template) {
      await this.calculateSummary(meter, readingDate, tx);
    }

    const allPotentialMeters = await tx.meter.findMany({
      where: { calculation_template_id: { not: null } },
      include: { calculation_template: { include: { definitions: true } } },
    });

    const dependentMeters = allPotentialMeters.filter((vMeter) => {
      if (vMeter.meter_id === meterId) return false;
      const defs = vMeter.calculation_template?.definitions ?? [];
      return defs.some((df) => {
        const formulaData = df.formula_items as unknown as FormulaItems;
        const vars = formulaData?.variables ?? [];
        return vars.some((v) => v.meterId === meterId);
      });
    });

    for (const depMeter of dependentMeters) {
      await this.calculateSummary(depMeter, readingDate, tx);
    }
  },

  async calculateSummary(meter: MeterWithTemplate, date: Date, tx: TxClient) {
    console.log(`[FormulaEngine] Processing Meter: ${meter.meter_code}`);

    const dbDictionary = await this.buildDbDictionary(meter, date, tx);

    const summaryDetails = [];
    let totalUsage = 0;
    const usedFormulaTemplateId = meter.calculation_template_id;
    const definitions = meter.calculation_template?.definitions ?? [];

    // BLOK EVALUASI RUMUS FINAL
    for (const formulaDef of definitions) {
      try {
        const formulaData = formulaDef.formula_items as unknown as FormulaItems;
        const rawFormula = formulaData.formula;
        const variables = formulaData.variables ?? [];

        const scope: Record<string, number> = {};

        variables.forEach((v) => {
          const mId = v.meterId ?? meter.meter_id;

          if (v.type === 'spec') {
            const specField = (v.specField ?? 'multiplier').toUpperCase();
            const dictKey = `M${mId}_SPEC_${specField}`;
            scope[v.label] = dbDictionary[dictKey] ?? (specField === 'MULTIPLIER' ? 1 : 0);
          } else if (v.type === 'constant') {
            scope[v.label] = Number((v as any).value ?? (v.label === 'PI' ? 3.141592653589793 : 1));
          } else {
            let suffix = 'H';
            if (v.timeShift === -1) suffix = 'Prev';
            if (v.timeShift === 1) suffix = 'Next';

            const rtId = v.readingTypeId;
            const dictKey = `M${mId}_RT${rtId}_${suffix}`;

            // Langsung fallback ke 0 jika data belum diinput (misal sore/malam belum ada)
            scope[v.label] = dbDictionary[dictKey] ?? 0;
          }
        });

        // Hitung rumus menggunakan parser
        let result = parser.evaluate(rawFormula, scope);

        // 👉 PENCEGATAN DATA PERTAMA & ANOMALI
        const isFirstData = variables.some((v) => {
          const mId = v.meterId ?? meter.meter_id;
          return dbDictionary[`M${mId}_IS_FIRST_DATA`] === 1;
        });

        // HANYA PAKSA 0 JIKA INI ADALAH RUMUS UTAMA (PEMAKAIAN)
        if (formulaDef.is_main) {
          if (isFirstData) {
            // Hari pertama: Pemakaian tidak bisa dihitung, set 0
            result = 0;
          } else if (result < 0) {
            // Hasil minus (misal salah input atau data gantung), set 0
            result = 0;
          }
        }

        // Rumus yang bukan main (seperti Stok & Durasi) akan lolos ke sini
        // dan tetap menghasilkan nilai yang benar berdasarkan Tinggi_Skrg.

        summaryDetails.push({
          label: formulaDef.name,
          value: result,
        });

        if (formulaDef.is_main) {
          totalUsage += Number(result);
        }
      } catch (e) {
        console.error(
          `[FormulaEngine] Gagal hitung ${formulaDef.name} pada meter ${meter.meter_code}:`,
          e,
        );
      }
    }

    // 2. AMBIL DATA CUACA

    const temperatureData = await fetchTodayTemperature(weatherConfig);

    if (temperatureData !== null) {
      // Push Suhu Rata-rata
      summaryDetails.push({
        label: 'Suhu Rata-rata', // Pastikan huruf kapitalnya sesuai selera Anda
        value: temperatureData.avg,
      });

      // Push Suhu Max
      summaryDetails.push({
        label: 'Suhu Max',
        value: temperatureData.max,
      });
    }

    // 3. AMBIL DATA HARI KERJA
    const dayType = getDayType(date);
    summaryDetails.push({
      label: 'Hari Kerja',
      value: dayType === 'WORKDAY' ? 1 : 0,
    });

    // 4. AMBIL DATA BIAYA (Solusi Error 2 & 3)
    const calculatedCost = await calculateDailyCost(meter.meter_id, date, tx as any, summaryDetails);

    const prismaSafeDate = toPrismaDate(date);

    await tx.dailySummary.upsert({
      where: {
        meter_id_summary_date: {
          meter_id: meter.meter_id,
          summary_date: prismaSafeDate,
        },
      },
      update: {
        total_usage: totalUsage,
        total_cost: calculatedCost.total_cost, // Perbaikan typo properti
        summary_details: { deleteMany: {}, create: summaryDetails },
        calculated_at: new Date(),
      },
      create: {
        meter_id: meter.meter_id,
        summary_date: prismaSafeDate,
        total_usage: totalUsage,
        total_cost: calculatedCost.total_cost, // Perbaikan typo properti
        used_formula_template_id: usedFormulaTemplateId ? String(usedFormulaTemplateId) : '',
        summary_details: { create: summaryDetails },
      },
    });
  },

  async buildDbDictionary(meter: MeterWithTemplate, targetDate: Date, tx: TxClient) {
    const dictionary: Record<string, number> = {};

    const requiredMeterIds = new Set<number>();
    requiredMeterIds.add(meter.meter_id);

    const definitions = meter.calculation_template?.definitions ?? [];

    definitions.forEach((df) => {
      const vars = (df.formula_items as unknown as FormulaItems)?.variables ?? [];
      vars.forEach((v) => {
        if (v.meterId) requiredMeterIds.add(v.meterId);
      });
    });

    const meterIdsArray = Array.from(requiredMeterIds);

    const metersSpecs = await tx.meter.findMany({
      where: { meter_id: { in: meterIdsArray } },
      include: {
        tank_profile: true,
        lifecycle_logs: {
          select: { initial_reading: true },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    metersSpecs.forEach((m) => {
      dictionary[`M${m.meter_id}_SPEC_MULTIPLIER`] = Number(m.multiplier ?? 1);

      const initialReading = m.lifecycle_logs?.[0]?.initial_reading ?? 0;
      dictionary[`M${m.meter_id}_SPEC_INITIAL_READING`] = Number(initialReading);

      if (m.tank_profile) {
        dictionary[`M${m.meter_id}_SPEC_HEIGHT_MAX_CM`] = Number(m.tank_profile.height_max_cm ?? 0);
        dictionary[`M${m.meter_id}_SPEC_CAPACITY_LITERS`] = Number(
          m.tank_profile.capacity_liters ?? 0,
        );
        dictionary[`M${m.meter_id}_SPEC_LENGTH_CM`] = Number(m.tank_profile.length_cm ?? 0);
        dictionary[`M${m.meter_id}_SPEC_WIDTH_CM`] = Number(m.tank_profile.width_cm ?? 0);
        dictionary[`M${m.meter_id}_SPEC_DIAMETER_CM`] = Number(m.tank_profile.diameter_cm ?? 0);
      }
    });

    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    const nextDateStr = format(addDays(targetDate, 1), 'yyyy-MM-dd');

    // 👉 PERBAIKAN: Gunakan Looping untuk mencari Prev dinamis per meter
    for (const mId of meterIdsArray) {
      // 1. Ambil data Current (H) & Next
      const currentAndNextSessions = await tx.readingSession.findMany({
        where: {
          meter_id: mId,
          reading_date: {
            gte: startOfDay(targetDate),
            lte: endOfDay(addDays(targetDate, 1)),
          },
        },
        include: { details: true },
      });

      currentAndNextSessions.forEach((session) => {
        const sessionDateStr = format(session.reading_date, 'yyyy-MM-dd');
        let suffix = '';
        if (sessionDateStr === targetDateStr) suffix = 'H';
        if (sessionDateStr === nextDateStr) suffix = 'Next';

        if (suffix) {
          session.details.forEach((det) => {
            const dictKey = `M${mId}_RT${det.reading_type_id}_${suffix}`;
            dictionary[dictKey] = Number(det.value);
          });
        }
      });

      // 2. Ambil data HARI SEBELUMNYA SECARA DINAMIS (Anti-Gap Bug)


      // 2. Ambil data HARI SEBELUMNYA SECARA DINAMIS
      const prevSession = await tx.readingSession.findFirst({
        where: {
          meter_id: mId,
          reading_date: { lt: startOfDay(targetDate) },
        },
        orderBy: { reading_date: 'desc' },
        include: { details: true },
      });

      // 👉 FLAG DATA PERTAMA (ABSOLUT)
      // Jika sama sekali tidak ada riwayat sebelum tanggal target,
      // kita berikan tanda khusus bahwa ini adalah Hari Pertama (Baseline).
      if (!prevSession || prevSession.details.length === 0) {
        dictionary[`M${mId}_IS_FIRST_DATA`] = 1;
      } else {
        // Jika ada riwayat, jalankan seperti biasa
        prevSession.details.forEach((det) => {
          const dictKey = `M${mId}_RT${det.reading_type_id}_Prev`;
          dictionary[dictKey] = Number(det.value);
        });
      }
    }
    return dictionary;
  },
};
