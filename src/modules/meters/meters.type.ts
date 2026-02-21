import { type Prisma } from '../../generated/prisma/index.js';

export interface MetersPayload {
  // UncheckedCreateInput memungkinkan kita kirim "energy_type_id": 1 secara langsung
  meter: Prisma.MeterUncheckedCreateInput;
  meter_profile?: Prisma.TankProfileUncheckedCreateInput;
  reading_config?: Prisma.MeterReadingConfigUncheckedCreateInput[];
}

export interface UpdateMetersPayload {
  meter?: Prisma.MeterUncheckedUpdateInput;
  meter_profile?: Prisma.TankProfileUncheckedUpdateInput;
  reading_config?: Prisma.MeterReadingConfigUncheckedCreateInput[];
}
