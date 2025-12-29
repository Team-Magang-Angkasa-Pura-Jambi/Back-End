import prisma from '../../configs/db.js';
import type { PaxData, Prisma } from '../../generated/prisma/index.js';
import type {
  CreatePaxParamsBody,
  UpdatePaxParamsBody,
} from '../../types/operations/pax.type.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';

export class PaxService extends GenericBaseService<
  typeof prisma.paxData,
  PaxData,
  CreatePaxParamsBody,
  UpdatePaxParamsBody,
  Prisma.PaxDataFindManyArgs,
  Prisma.PaxDataFindUniqueArgs,
  Prisma.PaxDataCreateArgs,
  Prisma.PaxDataUpdateArgs,
  Prisma.PaxDataDeleteArgs
> {
  constructor() {
    super(prisma, prisma.paxData, 'pax_id');
  }
}

export const paxService = new PaxService();
