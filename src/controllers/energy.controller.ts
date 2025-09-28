import { BaseController } from '../utils/baseController.js';
import type { EnergyType } from '../generated/prisma/index.js';
import type {
  CreateEnergyTypeBody,
  GetEnergyTypesQuery,
  UpdateEnergyTypeBody,
} from '../types/energy.type.js';
import { EnergyTypeService } from '../services/energy.service.js';
import type { NextFunction, Request, Response } from 'express';

export class EnergyTypeController extends BaseController<
  EnergyType,
  CreateEnergyTypeBody,
  UpdateEnergyTypeBody,
  GetEnergyTypesQuery,
  EnergyTypeService
> {
  constructor() {
    super(new EnergyTypeService(), 'energyTypeId');
  }
}
