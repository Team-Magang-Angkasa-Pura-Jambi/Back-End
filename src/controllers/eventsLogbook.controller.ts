import type { Request, Response } from 'express';
import type { EventsLogbook } from '../generated/prisma/index.js';
import { EventLogbookService } from '../services/eventsLogbook.service.js';
import type {
  CreateLogbookBody,
  GetLogbookQuery,
  UpdateLogbookBody,
} from '../types/eventsLogbook.type.js';

import { BaseController } from '../utils/baseController.js';
import { res200 } from '../utils/response.js';

export class EventLogbookController extends BaseController<
  EventsLogbook,
  CreateLogbookBody,
  UpdateLogbookBody,
  GetLogbookQuery,
  EventLogbookService
> {
  constructor() {
    super(new EventLogbookService(), 'eventId');
  }
  public override create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user?.id;

    const internalData = {
      ...req.body,
      reported_by_user_id: userId,
    };

    const newRecord = await this.service.create(internalData);

    res200({
      res,
      message: 'Event Logbook berhasil dibuat.',
      data: newRecord,
    });
  };
}
