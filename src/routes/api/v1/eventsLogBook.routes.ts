import type { Router } from 'express';
import { energyTypeSchema } from '../../../validations/energy.validation.js';

import { createCrudRouter } from '../../../utils/routerFactory.js';
import { EnergyTypeService } from '../../../services/energy.service.js';
import { EnergyTypeController } from '../../../controllers/energy.controller.js';
import { EventLogbookService } from '../../../services/eventsLogbook.service.js';
import { EventLogbookController } from '../../../controllers/eventsLogbook.controller.js';
import { logBookScheme } from '../../../validations/eventsLogbook.validation.js';

export default (router: Router) => {
  const eventsLogbookRouter = createCrudRouter('/event-logbook', {
    ServiceClass: EventLogbookService,
    ControllerClass: EventLogbookController,
    idParamName: 'eventId',

    schemas: {
      getAll: logBookScheme.listQuery,
      create: logBookScheme.create,
      update: logBookScheme.update,
      params: logBookScheme.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin'],
    },
  });

  router.use(eventsLogbookRouter);
};
