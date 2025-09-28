import prisma from '../configs/db.js';
import type { EventsLogbook, Prisma } from '../generated/prisma/index.js';
import type {
  CreateLogbookBody,
  UpdateLogbookBody,
} from '../types/eventsLogbook.type.js';

import { GenericBaseService } from '../utils/GenericBaseService.js';
type CreateEventsLogbookInternal = CreateLogbookBody & {
  reported_by_user_id: number;
};
export class EventLogbookService extends GenericBaseService<
  typeof prisma.eventsLogbook,
  EventsLogbook,
  CreateLogbookBody,
  UpdateLogbookBody,
  Prisma.EventsLogbookFindManyArgs,
  Prisma.EventsLogbookFindUniqueArgs,
  Prisma.EventsLogbookCreateArgs,
  Prisma.EventsLogbookUpdateArgs,
  Prisma.EventsLogbookDeleteArgs
> {
  constructor() {
    super(prisma, prisma.eventsLogbook, 'event_id');
  }
  public override async create(
    data: CreateEventsLogbookInternal
  ): Promise<EventsLogbook> {
    const { reported_by_user_id, ...restOfData } = data;

    const prismaData = {
      ...restOfData,

      reported_by: {
        connect: {
          user_id: reported_by_user_id,
        },
      },
    };

    return this._create({ data: prismaData });
  }
}
