import type { PaxData } from '../../generated/prisma/index.js';
import {
  paxService,
  PaxService,
} from '../../services/operations/pax.service.js';
import type {
  CreatePaxParamsBody,
  GetPaxParamsQuery,
  UpdatePaxParamsBody,
} from '../../types/pax.type.js';
import { BaseController } from '../../utils/baseController.js';

export class PaxController extends BaseController<
  PaxData,
  CreatePaxParamsBody,
  UpdatePaxParamsBody,
  GetPaxParamsQuery,
  PaxService
> {
  constructor() {
    super(paxService, 'paxId');
  }
}
