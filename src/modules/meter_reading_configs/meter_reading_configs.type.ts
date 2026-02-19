import { type Prisma } from '../../generated/prisma/index.js';

export interface ConfigPayload {
  config: Prisma.MeterReadingConfigUncheckedCreateInput;
}

export interface UpdateConfigPayload {
  config: Prisma.MeterReadingConfigUncheckedUpdateInput;
}
