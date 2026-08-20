import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { type EnergyPayload } from './energies.type.js';

export const energiesService = {
  store: async (payload: EnergyPayload) => {
    return await prisma.energyType.create({
      data: {
        name: payload.name,
        unit_standard: payload.unit_standard,

        reading_types: {
          create: payload.reading_types?.map((rt) => ({
            type_name: rt.type_name,
            unit: rt.unit,
          })),
        },
      },
      select: {
        energy_type_id: true,
        name: true,
        reading_types: true,
      },
    });
  },
  showWithReadingType: async () => {
    return await prisma.energyType.findMany({
      include: {
        reading_types: {
          include: {
            meter_configs: { select: { meter: { select: { meter_code: true, name: true } } } },
            scheme_rates: { select: { rate_value: true } },
          },
        },
      },
    });
  },
  show: async (id?: number, query?: { name?: string }) => {
    if (id) {
      return await prisma.energyType.findUnique({
        where: { energy_type_id: id },
        select: {
          energy_type_id: true,
          name: true,
          unit_standard: true,
          meters: {
            select: {
              meter_id: true,
              name: true,
            },
          },
          reading_types: {
            select: {
              reading_type_id: true,
              type_name: true,
              unit: true,
            },
          },
          annual_budgets: { select: { total_amount: true } },
        },
      });
    }
    const where: Prisma.EnergyTypeWhereInput = {};
    if (query?.name) {
      where.name = { contains: query.name };
    }

    return await prisma.energyType.findMany();
  },
  patch: async (id: number, payload: EnergyPayload) => {
    try {
      const { reading_types, ...energyData } = payload;

      return await prisma.$transaction(async (tx) => {
        if (reading_types) {
          // 1. Ambil seluruh data reading_type yang saat ini ada di DB
          const existingTypes = await tx.readingType.findMany({
            where: { energy_type_id: id },
          });

          // 2. Petakan ID yang dikirim oleh frontend
          const incomingIds = reading_types
            .map((rt) => rt.reading_type_id)
            .filter(
              (readingId): readingId is number => readingId !== undefined && readingId !== null,
            );

          // 3. Tentukan data mana yang harus dihapus
          const idsToDelete = existingTypes
            .filter((existing) => !incomingIds.includes(existing.reading_type_id))
            .map((existing) => existing.reading_type_id);

          // 4. Eksekusi Hapus dengan Pengecekan Constraint (SAFE DELETE)
          if (idsToDelete.length > 0) {
            // Cek apakah ID yang akan dihapus sedang dipakai di tabel relasinya
            const isUsedInConfig = await tx.meterReadingConfig.findFirst({
              where: { reading_type_id: { in: idsToDelete } },
            });
            const isUsedInDetail = await tx.readingDetail.findFirst({
              where: { reading_type_id: { in: idsToDelete } },
            });
            const isUsedInScheme = await tx.schemeRate.findFirst({
              where: { reading_type_id: { in: idsToDelete } },
            });

            // Jika ada satu saja yang terpakai, lemparkan Error spesifik
            if (isUsedInConfig || isUsedInDetail || isUsedInScheme) {
              throw new Error(
                'Gagal menyimpan: Terdapat Jenis Pembacaan (Reading Type) yang dihapus padahal masih digunakan pada Konfigurasi Meteran, Data Pencatatan, atau Skema Harga.',
              );
            }

            // Jika lolos pengecekan (tidak dipakai di mana pun), aman untuk dihapus
            await tx.readingType.deleteMany({
              where: {
                reading_type_id: { in: idsToDelete },
              },
            });
          }

          // 5. Lakukan Loop untuk Update atau Create
          for (const rt of reading_types) {
            if (rt.reading_type_id) {
              await tx.readingType.update({
                where: { reading_type_id: rt.reading_type_id },
                data: {
                  type_name: rt.type_name,
                  unit: rt.unit,
                },
              });
            } else {
              await tx.readingType.create({
                data: {
                  type_name: rt.type_name,
                  unit: rt.unit,
                  energy_type_id: id,
                },
              });
            }
          }
        }

        // 6. Update data utama EnergyType
        return await tx.energyType.update({
          where: { energy_type_id: id },
          data: energyData,
          include: {
            reading_types: {
              orderBy: { reading_type_id: 'asc' },
            },
          },
        });
      });
    } catch (error: any) {
      // Jika error berasal dari throw new Error manual kita, teruskan pesannya.
      // Jika error database mentah, lempar ke handler bawaan Anda.
      if (error instanceof Error && error.message.includes('Gagal menyimpan')) {
        throw error; // Atau gunakan helper spesifik jika ada: return formatError(400, error.message);
      }
      return handlePrismaError(error, 'Energi');
    }
  },
  remove: async (id: number) => {
    try {
      return await prisma.energyType.delete({
        where: { energy_type_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Energi');
    }
  },
};
