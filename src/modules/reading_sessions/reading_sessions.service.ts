import prisma from '../../configs/db.js';
import { handlePrismaError } from '../../common/utils/prismaError.js';
import { Error400, Error404 } from '../../utils/customError.js';
import {
  _checkUsageAgainstTargetAndNotify,
  _normalizeDate,
  _validateMeter,
} from './utils/reading.utils.js';
import { readingValidator } from './utils/reading.validator.js';
import { formulaEngine } from './utils/formula.engine.js';

export const readingService = {
  store: async (payload: any, userId: number) => {
    try {
      const { meter_id, reading_date, details, evidence_image_url, notes } = payload.reading;

      // Pastikan tanggal dinormalisasi (misal: set jam ke 00:00:00 untuk pencatatan harian)
      const dateForDb = _normalizeDate(reading_date);

      return await prisma.$transaction(async (tx: any) => {
        // 1. Validasi keberadaan dan status Meter
        const meter = await _validateMeter(meter_id, tx);

        // 2. Validasi nilai pembacaan (cegah nilai minus, cek rollover, dll)
        await readingValidator.validate(meter, dateForDb, details, tx);

        // 3. Simpan sesi pembacaan dan detail sensor (WBP, LWBP, dll)
        const session = await tx.readingSession.create({
          data: {
            meter_id,
            reading_date: dateForDb,
            captured_by_user_id: userId,
            evidence_image_url,
            notes,
            details: {
              // <--- UBAH INI DARI reading_details MENJADI details
              create: details.map((d: any) => ({
                reading_type_id: d.reading_type_id,
                value: d.value,
              })),
            },
          },
          include: {
            details: {
              // <--- UBAH INI JUGA
              include: { reading_type: true },
            },
          },
        });

        // 4. TRIGGER OTOMATIS FORMULA ENGINE
        // Setelah data sensor masuk, langsung suruh mesin menghitung rumusnya!
        await formulaEngine.run(meter_id, dateForDb, tx);

        // (Opsional) Cek KPI / Budget Efisiensi
        const summary = await tx.dailySummary.findUnique({
          where: {
            meter_id_summary_date: { meter_id, summary_date: dateForDb },
          },
        });
        if (summary) {
          await _checkUsageAgainstTargetAndNotify(summary, meter, tx);
        }

        return session;
      });
    } catch (error) {
      return handlePrismaError(error, 'Reading Session');
    }
  },
  show: async (query: any) => {
    try {
      const { meter_id, from_date, to_date, page, limit } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (meter_id) where.meter_id = meter_id;
      if (from_date || to_date) {
        where.reading_date = {
          gte: from_date ? new Date(from_date) : undefined,
          lte: to_date ? new Date(to_date) : undefined,
        };
      }

      const [data, total] = await Promise.all([
        prisma.readingSession.findMany({
          where,
          skip,
          take: limit,
          orderBy: { reading_date: 'desc' },
          include: {
            details: { include: { reading_type: true } },

            captured_by: { select: { username: true } },
            meter: { select: { name: true } },
          },
        }),
        prisma.readingSession.count({ where }),
      ]);

      return { data, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
    } catch (error) {
      return handlePrismaError(error, 'Reading Session');
    }
  },

  remove: async (id: number) => {
    try {
      const reading = await prisma.readingSession.findUnique({ where: { session_id: id } });
      if (!reading) throw new Error404('Data tidak ditemukan');

      const newer = await prisma.readingSession.findFirst({
        where: { meter_id: reading.meter_id, reading_date: { gt: reading.reading_date } },
      });
      if (newer) throw new Error400('Hanya data pembacaan terbaru yang boleh dihapus.');

      return await prisma.readingSession.delete({ where: { session_id: id } });
    } catch (error) {
      return handlePrismaError(error, 'Reading Session');
    }
  },
};
