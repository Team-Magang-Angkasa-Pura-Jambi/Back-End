import { differenceInDays, format } from 'date-fns';
import { Prisma } from '../../../generated/prisma/index.js';
import { Error400 } from '../../../utils/customError.js';
import { Parser } from 'expr-eval';

const parser = new Parser();

export interface ReadingDetailInput {
  reading_type_id: number;
  value: string | number | null;
}

export interface ValidationRule {
  rule: string;
  error_message: string;
}

export type ValidatedMeter = Prisma.MeterGetPayload<{
  include: {
    reading_configs: {
      include: { reading_type: true };
    };
    tank_profile: true;
    calculation_template: true;
  };
}>;

export const readingValidator = {
  async validate(
    meter: ValidatedMeter,
    dateForDb: Date,
    details: ReadingDetailInput[],
    tx: any,
  ) {
    // ==========================================
    // 1. VALIDASI KRONOLOGI MASA DEPAN (Mencegah input mundur)
    // ==========================================
    const futureSession = await tx.readingSession.findFirst({
      where: { meter_id: meter.meter_id, reading_date: { gt: dateForDb } },
    });

    if (futureSession) {
      const formattedDate = format(futureSession.reading_date, 'yyyy-MM-dd');
      throw new Error400(
        `Gagal: Sudah ada data yang lebih baru pada tanggal ${formattedDate}. Tidak boleh mundur.`,
      );
    }

    // ==========================================
    // 2. AMBIL DATA SESI SEBELUMNYA & CEK GAP
    // ==========================================
    const prevSession = await tx.readingSession.findFirst({
      where: { meter_id: meter.meter_id, reading_date: { lt: dateForDb } },
      orderBy: { reading_date: 'desc' },
      include: { details: true },
    });

    if (prevSession) {
      // Deteksi apakah ini meteran BBM (memiliki profil tangki)
      const isBBM = !!meter.tank_profile;

      // Aturan gap tanggal HANYA berlaku jika allow_gap = false DAN BUKAN meteran BBM
      if (!meter.allow_gap && !isBBM) {
        const diffDays = differenceInDays(dateForDb, prevSession.reading_date);
        if (diffDays > 1) {
          const formattedPrevDate = format(prevSession.reading_date, 'yyyy-MM-dd');
          throw new Error400(`Data tidak urut. Data terakhir ditemukan pada ${formattedPrevDate}.`);
        }
      }
    }

    // ==========================================
    // 3. VALIDASI AMBANG BATAS & TANGKI
    // ==========================================
    for (const det of details) {
      if (det.value === null || det.value === '') continue;

      const inputVal = new Prisma.Decimal(det.value as string | number);
      const config = meter.reading_configs?.find((c) => c.reading_type_id === det.reading_type_id);

      if (config) {
        if (
          config.alarm_max_threshold &&
          inputVal.greaterThan(new Prisma.Decimal(config.alarm_max_threshold))
        ) {
          throw new Error400(`Nilai input melebihi batas alarm maksimal sensor.`);
        }
        if (
          config.alarm_min_threshold &&
          inputVal.lessThan(new Prisma.Decimal(config.alarm_min_threshold))
        ) {
          throw new Error400(`Nilai input kurang dari batas alarm minimal sensor.`);
        }

        if (meter.tank_profile && config.reading_type) {
          const unit = config.reading_type.unit.toLowerCase();

          if (unit === 'cm') {
            const maxH = new Prisma.Decimal(meter.tank_profile.height_max_cm);
            if (inputVal.greaterThan(maxH)) {
              throw new Error400(
                `Input (${inputVal.toString()} cm) melebihi batas maksimal tinggi tangki (${maxH.toString()} cm).`,
              );
            }
          }

          if (unit === 'liters' || unit === 'liter') {
            const maxV = new Prisma.Decimal(meter.tank_profile.capacity_liters);
            if (inputVal.greaterThan(maxV)) {
              throw new Error400(
                `Input (${inputVal.toString()} L) melebihi kapasitas maksimal tangki (${maxV.toString()} L).`,
              );
            }
          }
        }
      }
    }

    // ==========================================
    // 4. VALIDASI DINAMIS DARI TEMPLATE JSON
    // ==========================================
    const validations = (meter.calculation_template?.validations ||
      []) as unknown as ValidationRule[];

    if (validations.length > 0) {
      const scope: Record<string, number> = {};

      // A. Muat data dari HARI KEMARIN (Mendukung suffix _Prev dan _Kmrn)
      if (prevSession && prevSession.details) {
        for (const prevDet of prevSession.details) {
          const config = meter.reading_configs?.find(
            (c) => c.reading_type_id === prevDet.reading_type_id,
          );
          if (config && config.reading_type?.type_name) {
            const label = config.reading_type.type_name.replace(/\s+/g, '_');
            const val = Number(prevDet.value);

            scope[label] = val;
            scope[`${label}_Prev`] = val;
            scope[`${label}_Kmrn`] = val; // Selaras dengan format LWBP_Kmrn / WBP_Kmrn
          }
        }
      }

      // B. Muat data hari ini yang sudah tersimpan (Antisipasi input parsial shift)
      const existingTodaySession = await tx.readingSession.findFirst({
        where: { meter_id: meter.meter_id, reading_date: dateForDb },
        include: { details: true },
      });

      if (existingTodaySession) {
        for (const existingDet of existingTodaySession.details) {
          const config = meter.reading_configs?.find(
            (c) => c.reading_type_id === existingDet.reading_type_id,
          );
          if (config && config.reading_type?.type_name) {
            const label = config.reading_type.type_name.replace(/\s+/g, '_');
            scope[label] = Number(existingDet.value);
          }
        }
      }

      // C. Timpa dengan nilai inputan baru dari payload teknisi saat ini (Mendukung _Skrg)
      for (const det of details) {
        const config = meter.reading_configs?.find(
          (c) => c.reading_type_id === det.reading_type_id,
        );
        if (config && config.reading_type?.type_name) {
          const label = config.reading_type.type_name.replace(/\s+/g, '_');
          const val = Number(det.value);

          scope[label] = val;
          scope[`${label}_Skrg`] = val; // Selaras dengan format LWBP_Skrg / WBP_Skrg
        }
      }

      // D. Eksekusi Evaluasi Rumus Validasi
      for (const validation of validations) {
        try {
          const ruleExpr = parser.parse(validation.rule);
          const ruleVars = ruleExpr.variables();

          const isAllVarsPresent = ruleVars.every((v) => scope[v] !== undefined);

          if (isAllVarsPresent) {
            const isRulePassed = ruleExpr.evaluate(scope);

            if (!isRulePassed) {
              throw new Error400(`Validasi Gagal: ${validation.error_message}`);
            }
          }
        } catch (e: unknown) {
          if (e instanceof Error400) throw e;
          console.error(`[Validator] Gagal mem-parsing rule JSON: ${validation.rule}`, e);
        }
      }
    }
  },
};
