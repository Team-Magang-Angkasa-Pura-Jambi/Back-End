import { BaseController } from '../../utils/baseController.js';
import type { Tax } from '../../generated/prisma/index.js';
import type {
  CreateTaxBody,
  GetTaxQuery,
  UpdateTaxBody,
} from '../../types/finance/tax.type.js';
import { taxService, TaxService } from '../../services/finance/tax.service.js';

export class TaxController extends BaseController<
  Tax,
  CreateTaxBody,
  UpdateTaxBody,
  GetTaxQuery,
  TaxService
> {
  constructor() {
    super(taxService, 'taxId');
  }
}
