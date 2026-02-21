import type prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';

// Mengambil tipe data asli dari Prisma untuk operasi 'create'
type EnergyCreateInput = Prisma.Args<typeof prisma.energyType, 'create'>['data'];
type ReadingTypeCreateInput = Prisma.Args<typeof prisma.readingType, 'create'>['data'];

/**
 * Payload untuk Sentinel Project
 * Menggabungkan input EnergyType dengan array ReadingType (nested operation)
 */
export type EnergyPayload = EnergyCreateInput & {
  reading_types?: ReadingTypeCreateInput[];
};
