import { Parser } from 'expr-eval';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { type PrismaClient } from '../../../generated/prisma/index.js';

const parser = new Parser();

// --- 1. DEFINISI INTERFACE UNTUK JSON FORMULA ---
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

/**
 * Tipe Client Prisma untuk transaksi (Transaction Client).
 */
type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const formulaEngine = {
  /**
   * Menjalankan kalkulasi untuk satu meter dan memicu kalkulasi pada meter dependen (virtual).
   */
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
        // FIX ERROR 1: Casting Json ke Interface FormulaItems
        const formulaData = df.formula_items as unknown as FormulaItems;
        const vars = formulaData?.variables ?? [];
        return vars.some((v) => v.meterId === meterId);
      });
    });

    for (const depMeter of dependentMeters) {
      await this.calculateSummary(depMeter, readingDate, tx);
    }
  },

  /**
   * Inti Kalkulasi: Mengambil data dictionary dan mengevaluasi rumus satu per satu
   */
  async calculateSummary(meter: any, date: Date, tx: TxClient) {
    console.log(`[FormulaEngine] Processing Meter: ${meter.meter_code}`);

    const dbDictionary = await this.buildDbDictionary(meter, date, tx);

    const summaryDetails = [];
    let totalUsage = 0;
    const usedFormulaTemplateId = meter.calculation_template_id;

    const definitions = meter.calculation_template?.definitions ?? [];

    for (const formulaDef of definitions) {
      try {
        // FIX: Casting Json ke Interface FormulaItems
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
          } else {
            const suffix = v.timeShift === -1 ? 'Prev' : 'H';
            const rtId = v.readingTypeId;
            const dictKey = `M${mId}_RT${rtId}_${suffix}`;
            scope[v.label] = dbDictionary[dictKey] ?? 0;
          }
        });

        const result = parser.evaluate(rawFormula, scope);

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

    await tx.dailySummary.upsert({
      where: {
        meter_id_summary_date: {
          meter_id: meter.meter_id,
          summary_date: startOfDay(date),
        },
      },
      update: {
        total_usage: totalUsage,
        summary_details: { deleteMany: {}, create: summaryDetails },
        calculated_at: new Date(),
      },
      create: {
        meter_id: meter.meter_id,
        summary_date: startOfDay(date),
        total_usage: totalUsage,
        total_cost: 0,
        used_formula_template_id: String(usedFormulaTemplateId),
        summary_details: { create: summaryDetails },
      },
    });
  },

  /**
   * Mengumpulkan semua data yang dibutuhkan dari database dalam satu batch query.
   */
  async buildDbDictionary(meter: any, targetDate: Date, tx: TxClient) {
    const dictionary: Record<string, number> = {};
    const datePrev = startOfDay(subDays(targetDate, 1));

    const requiredMeterIds = new Set<number>();
    requiredMeterIds.add(meter.meter_id);

    const definitions = meter.calculation_template?.definitions ?? [];
    definitions.forEach((df: any) => {
      const vars = (df.formula_items as unknown as FormulaItems)?.variables ?? [];
      vars.forEach((v) => {
        if (v.meterId) requiredMeterIds.add(v.meterId);
      });
    });

    const meterIdsArray = Array.from(requiredMeterIds);

    // 1. Ambil Spesifikasi Meter
    const metersSpecs = await tx.meter.findMany({
      where: { meter_id: { in: meterIdsArray } },
    });

    metersSpecs.forEach((m: any) => {
      // FIX ERROR 2: Menggunakan casting 'any' sementara pada iterasi
      // untuk memastikan initial_reading terbaca jika Prisma generate belum sinkron
      dictionary[`M${m.meter_id}_SPEC_MULTIPLIER`] = Number(m.multiplier ?? 1);
      dictionary[`M${m.meter_id}_SPEC_INITIAL_READING`] = Number(m.initial_reading ?? 0);
    });

    // 2. Ambil Data Reading (Hari Ini & Kemarin)
    const sessions = await tx.readingSession.findMany({
      where: {
        meter_id: { in: meterIdsArray },
        reading_date: {
          gte: datePrev,
          lte: endOfDay(targetDate),
        },
      },
      include: { details: true },
    });

    sessions.forEach((session: any) => {
      const isToday =
        format(session.reading_date, 'yyyy-MM-dd') === format(targetDate, 'yyyy-MM-dd');
      const suffix = isToday ? 'H' : 'Prev';

      session.details.forEach((det: any) => {
        const dictKey = `M${session.meter_id}_RT${det.reading_type_id}_${suffix}`;
        dictionary[dictKey] = Number(det.value);
      });
    });

    return dictionary;
  },
};
