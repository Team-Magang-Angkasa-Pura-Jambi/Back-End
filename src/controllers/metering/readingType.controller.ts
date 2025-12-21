import { ReadingTypeService } from '../../services/metering/readingType.service.js';
import { BaseController } from '../../utils/baseController.js';
import type {
  CreateReadingTypeBody,
  GetReadingTypesQuery,
  UpdateReadingTypeBody,
} from '../../types/readingType.type.js';
import type { ReadingType } from '../../generated/prisma/index.js';


/**
 * Controller untuk menangani request HTTP terkait Tipe Pembacaan.
 */
export class ReadingTypeController extends BaseController<
  ReadingType,
  CreateReadingTypeBody,
  UpdateReadingTypeBody,
  GetReadingTypesQuery,
  ReadingTypeService
> {
  constructor() {
    super(new ReadingTypeService(), 'readingTypeId');
  }
}
export const readingTypeController = new ReadingTypeController();
