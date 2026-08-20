import { handlePrismaError } from '../../common/utils/prismaError.js';
import { Error400, Error404 } from '../../utils/customError.js';
import {
  _checkUsageAgainstTargetAndNotify,
  _normalizeDate,
  _validateMeter,
} from './utils/reading.utils.js';
import { readingValidator } from './utils/reading.validator.js';
import { formulaEngine } from './utils/formula.engine.js';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { z } from 'zod';
import { readingSchema } from './reading_sessions.schema.js';

import prisma from '../../configs/db.js';
import { Prisma } from '../../generated/prisma/index.js';

type StorePayload = z.infer<typeof readingSchema.store>['body'];
type UpdatePayload = z.infer<typeof readingSchema.update>['body'];
type ShowQuery = z.infer<typeof readingSchema.show>['query'];
type RecalculatePayload = z.infer<typeof readingSchema.recalculate>['body'];

export const readingService = {
  store: async (payload: StorePayload, userId: number) => {
    try {
      const { meter_id, reading_date, details, evidence_image_url, notes } = payload.reading;

      const dateForDb = _normalizeDate(reading_date);

      return await prisma.$transaction(async (tx) => {
        // Race condition prevention: Cek apakah data pada meter & tanggal ini sudah pernah dicatat
        const existingSession = await tx.readingSession.findFirst({
          where: {
            meter_id,
            reading_date: {
              gte: startOfDay(dateForDb),
              lte: endOfDay(dateForDb),
            },
          },
        });

        if (existingSession) {
          throw new Error400(
            `Data pencatatan untuk meteran ini pada tanggal ${dateForDb.toISOString().split('T')[0]} sudah ada (ID: #${existingSession.session_id}). Silakan gunakan menu Edit jika ingin mengubah angka meteran.`
          );
        }

        const meter = await _validateMeter(meter_id, tx);
        await readingValidator.validate(meter, dateForDb, details, tx);

        const session = await tx.readingSession.create({
          data: {
            meter_id,
            reading_date: dateForDb,
            captured_by_user_id: userId,
            evidence_image_url,
            notes,
            details: {
              create: details.map((d) => ({
                reading_type_id: d.reading_type_id,
                value: d.value,
              })),
            },
          },
          include: {
            details: {
              include: { reading_type: true },
            },
          },
        });

        // Audit Trail: Catat pembacaan meter baru ke public.audit_logs
        await tx.auditLog.create({
          data: {
            user_id: userId,
            action: 'CREATE',
            entity_table: 'ReadingSession',
            entity_id: String(session.session_id),
            old_values: Prisma.DbNull,
            new_values: {
              session_id: session.session_id,
              meter_id: session.meter_id,
              meter_code: meter.meter_code,
              meter_name: meter.name,
              reading_date: session.reading_date,
              captured_by_user_id: session.captured_by_user_id,
              notes: session.notes,
              details: session.details.map((d) => ({
                reading_type_id: d.reading_type_id,
                reading_type_name: d.reading_type.type_name,
                value: Number(d.value),
                unit: d.reading_type.unit,
              })),
            } as any,
            reason: `Pencatatan data stand meteran ${meter.name} (${meter.meter_code})`,
          },
        });

        await formulaEngine.run(meter_id, dateForDb, tx);
        console.log(`[readingService] Processing Meter: ${dateForDb}`);

        const yesterday = subDays(dateForDb, 1);
        const prevSession = await tx.readingSession.findFirst({
          where: {
            meter_id,
            reading_date: {
              gte: startOfDay(yesterday),
              lte: endOfDay(yesterday),
            },
          },
        });

        if (prevSession) {
          await formulaEngine.run(meter_id, yesterday, tx);
          console.log(`[readingService] Re-Processing H-1 Meter: ${yesterday}`);
        }

        const summary = await tx.dailySummary.findUnique({
          where: {
            meter_id_summary_date: { meter_id, summary_date: dateForDb },
          },
        });

        if (summary) {
          await _checkUsageAgainstTargetAndNotify(userId, summary, meter, tx);
        }

        return session;
      });
    } catch (error) {
      return handlePrismaError(error, 'Reading Session');
    }
  },

  show: async (query: ShowQuery) => {
    try {
      const { meter_id, from_date, to_date, page, limit } = query;

      const safePage = page ?? 1;
      const safeLimit = limit ?? 10;
      const skip = (safePage - 1) * safeLimit;

      const where: Prisma.ReadingSessionWhereInput = {};
      if (meter_id) where.meter_id = meter_id;
      if (from_date || to_date) {
        where.reading_date = {
          gte: from_date,
          lte: to_date,
        };
      }

      const [data, total] = await Promise.all([
        prisma.readingSession.findMany({
          where,
          skip,
          take: safeLimit,
          orderBy: { reading_date: 'desc' },
          include: {
            details: { include: { reading_type: true } },
            captured_by: { select: { username: true } },
            meter: { select: { name: true } },
          },
        }),
        prisma.readingSession.count({ where }),
      ]);

      return {
        data,
        meta: {
          total,
          page: safePage,
          limit: safeLimit,
          total_pages: Math.ceil(total / safeLimit),
        },
      };
    } catch (error) {
      return handlePrismaError(error, 'Reading Session');
    }
  },

  update: async (sessionId: number, payload: UpdatePayload, userId: number) => {
    try {
      const dataToUpdate = payload.reading;
      if (!dataToUpdate) throw new Error400('Payload data reading tidak valid');

      const { meter_id, reading_date, details, evidence_image_url, notes } = dataToUpdate;

      const dateForDb = reading_date ? _normalizeDate(reading_date) : new Date();

      return await prisma.$transaction(async (tx) => {
        const existingSession = await tx.readingSession.findUnique({
          where: { session_id: sessionId },
          include: { details: true },
        });

        if (!existingSession) {
          throw new Error('Reading session not found');
        }

        const targetMeterId = meter_id ?? existingSession.meter_id;
        const meter = await _validateMeter(targetMeterId, tx);

        if (details && details.length > 0) {
          await readingValidator.validate(meter, dateForDb, details, tx);
        }

        const session = await tx.readingSession.update({
          where: { session_id: sessionId },
          data: {
            reading_date: reading_date ? dateForDb : undefined,
            evidence_image_url:
              evidence_image_url !== undefined
                ? evidence_image_url
                : existingSession.evidence_image_url,
            notes: notes !== undefined ? notes : existingSession.notes,
            details: details
              ? {
                  deleteMany: {},
                  create: details.map((d) => ({
                    reading_type_id: d.reading_type_id,
                    value: d.value,
                  })),
                }
              : undefined,
          },
          include: {
            details: {
              include: { reading_type: true },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            user_id: userId,
            action: 'UPDATE',
            entity_table: 'ReadingSession',
            entity_id: String(sessionId),
            old_values: existingSession as any,
            new_values: session as any,
            reason: `User memperbarui nilai stand meteran ${meter.name} (${meter.meter_code})`,
          },
        });

        await formulaEngine.run(targetMeterId, dateForDb, tx);
        console.log(`[readingService] Re-Processing Meter: ${dateForDb}`);

        const yesterday = subDays(dateForDb, 1);
        const prevSession = await tx.readingSession.findFirst({
          where: {
            meter_id: targetMeterId,
            reading_date: {
              gte: startOfDay(yesterday),
              lte: endOfDay(yesterday),
            },
          },
        });

        if (prevSession) {
          await formulaEngine.run(targetMeterId, yesterday, tx);
          console.log(`[readingService] Re-Processing H-1 Meter (Update): ${yesterday}`);
        }

        const summary = await tx.dailySummary.findUnique({
          where: {
            meter_id_summary_date: { meter_id: targetMeterId, summary_date: dateForDb },
          },
        });

        if (summary) {
          await _checkUsageAgainstTargetAndNotify(userId, summary, meter, tx);
        }

        return session;
      });
    } catch (error) {
      return handlePrismaError(error, 'Reading Session');
    }
  },

  remove: async (id: number) => {
    try {
      const reading = await prisma.readingSession.findUnique({
        where: { session_id: id },
        include: { details: true },
      });
      if (!reading) throw new Error404('Data tidak ditemukan');

      const newer = await prisma.readingSession.findFirst({
        where: { meter_id: reading.meter_id, reading_date: { gt: reading.reading_date } },
      });
      if (newer) throw new Error400('Hanya data pembacaan terbaru yang boleh dihapus.');

      return await prisma.$transaction(async (tx) => {
        const deleted = await tx.readingSession.delete({ where: { session_id: id } });

        await tx.auditLog.create({
          data: {
            user_id: 1,
            action: 'DELETE',
            entity_table: 'ReadingSession',
            entity_id: String(id),
            old_values: reading as any,
            new_values: Prisma.DbNull,
            reason: 'Penghapusan data pencatatan meteran',
          },
        });

        return deleted;
      });
    } catch (error) {
      return handlePrismaError(error, 'Reading Session');
    }
  },

  recalculate: async (payload: RecalculatePayload) => {
    const { start_date, to_date, meter_id } = payload;
    try {
      const normalizedStart = _normalizeDate(start_date);
      const normalizedEnd = _normalizeDate(to_date);

      return await prisma.$transaction(async (tx) => {
        const readingSessions = await tx.readingSession.findMany({
          where: {
            meter_id,
            reading_date: {
              gte: normalizedStart,
              lte: normalizedEnd,
            },
          },
          orderBy: {
            reading_date: 'asc',
          },
        });

        if (readingSessions.length === 0) {
          return {
            message: 'Tidak ada data untuk dikalkulasi ulang pada rentang waktu ini.',
            count: 0,
          };
        }

        for (const session of readingSessions) {
          await formulaEngine.run(meter_id, session.reading_date, tx);
        }

        return {
          message: 'Kalkulasi ulang berhasil.',
          count: readingSessions.length,
        };
      });
    } catch (error) {
      return handlePrismaError(error, 'Recalculate Reading Session');
    }
  },

  getLastReading: async (query: {
    meterId?: number;
    meter_id?: number;
    readingTypeId?: number;
    reading_type_id?: number;
    readingDate?: string;
    reading_date?: string;
  }) => {
    try {
      const targetMeterId = query.meter_id ?? query.meterId;
      const targetReadingTypeId = query.reading_type_id ?? query.readingTypeId;
      const dateInput = query.reading_date ?? query.readingDate;

      if (!targetMeterId) {
        throw new Error400('meter_id wajib disediakan');
      }

      const meter = await prisma.meter.findUnique({
        where: { meter_id: Number(targetMeterId) },
        select: { meter_id: true, meter_code: true, name: true },
      });

      if (!meter) throw new Error404('Meteran tidak ditemukan');

      // Cari sesi pembacaan terakhir
      const whereSession: Prisma.ReadingSessionWhereInput = {
        meter_id: Number(targetMeterId),
      };

      if (dateInput) {
        try {
          const parsedDate = new Date(dateInput);
          if (!isNaN(parsedDate.getTime())) {
            whereSession.reading_date = { lte: parsedDate };
          }
        } catch {}
      }

      const lastSession = await prisma.readingSession.findFirst({
        where: whereSession,
        orderBy: { reading_date: 'desc' },
        include: {
          details: {
            include: {
              reading_type: true,
            },
          },
        },
      });

      if (!lastSession) {
        const today = new Date();
        return {
          meter_id: Number(targetMeterId),
          meter_code: meter.meter_code,
          meter_name: meter.name,
          last_session_id: null,
          last_reading_date: null,
          last_reading_date_formatted: null,
          suggested_next_date: today.toISOString(),
          suggested_next_date_formatted: today.toISOString().split('T')[0],
          last_consumption: 0,
          details: [],
          value: 0,
          session: {
            reading_date: today,
          },
        };
      }

      // Cari ringkasan harian (konsumsi) pada tanggal sesi terakhir tersebut
      const dailySum = await prisma.dailySummary.findUnique({
        where: {
          meter_id_summary_date: {
            meter_id: Number(targetMeterId),
            summary_date: lastSession.reading_date,
          },
        },
        select: {
          total_usage: true,
          total_cost: true,
        },
      });

      // Hitung tanggal selanjutnya (Tanggal Terakhir + 1 Hari)
      const nextDate = new Date(lastSession.reading_date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Detail per reading type
      const detailsMap = lastSession.details.map((d) => ({
        reading_type_id: d.reading_type_id,
        reading_type_name: d.reading_type.type_name,
        unit: d.reading_type.unit,
        last_value: Number(d.value),
      }));

      const specificDetail = targetReadingTypeId
        ? lastSession.details.find((d) => d.reading_type_id === Number(targetReadingTypeId))
        : lastSession.details[0];

      const specificValue = specificDetail ? Number(specificDetail.value) : 0;

      return {
        meter_id: Number(targetMeterId),
        meter_code: meter.meter_code,
        meter_name: meter.name,
        last_session_id: lastSession.session_id,
        last_reading_date: lastSession.reading_date.toISOString(),
        last_reading_date_formatted: lastSession.reading_date.toISOString().split('T')[0],
        suggested_next_date: nextDate.toISOString(),
        suggested_next_date_formatted: nextDate.toISOString().split('T')[0],
        last_consumption: dailySum?.total_usage ? Number(dailySum.total_usage) : 0,
        last_cost: dailySum?.total_cost ? Number(dailySum.total_cost) : 0,
        details: detailsMap,
        value: specificValue,
        reading_type_id: specificDetail?.reading_type_id || targetReadingTypeId || 0,
        session: {
          reading_date: lastSession.reading_date,
        },
      };
    } catch (error) {
      return handlePrismaError(error, 'Get Last Reading');
    }
  },
};
