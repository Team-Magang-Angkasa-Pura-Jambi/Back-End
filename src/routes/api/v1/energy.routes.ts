import type { Router } from 'express';
import { energyTypeController } from '../../../controllers/energy.controller.js';
import {
  createEnergyTypeSchema,
  updateEnergyTypeSchema,
} from '../../../validations/energy.validation.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';

export const energyTypeRoutes = (router: Router) => {
  const prefix = '/energy-types';

  router.get(prefix, asyncHandler(energyTypeController.getAllEnergyTypes));
  router.get(
    prefix + '-active',
    asyncHandler(energyTypeController.getAllActiveEnergyTypes)
  );
  router.post(
    prefix,
    validate(createEnergyTypeSchema),
    asyncHandler(energyTypeController.createEnergyType)
  );

  router.get(
    prefix + '/:id',
    asyncHandler(energyTypeController.getEnergyTypeById)
  );

  router.put(
    prefix + '/:id',
    validate(updateEnergyTypeSchema),
    asyncHandler(energyTypeController.updateEnergyType)
  );

  router.delete(
    prefix + '/:id',
    asyncHandler(energyTypeController.deleteEnergyType)
  );
};
