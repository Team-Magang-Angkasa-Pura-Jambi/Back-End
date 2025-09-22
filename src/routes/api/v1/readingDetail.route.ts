import { Router } from 'express';
import { ReadingDetailService } from '../../../services/readingDetail.service.js';
import { ReadingDetailController } from '../../../controllers/readingDetail.controller.js';
import {
  createReadingDetailSchema,
  readingDetailParamsSchema,
  updateReadingDetailSchema,
} from '../../../validations/readingDetail.validations.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

const readingDetailService = new ReadingDetailService();
const readingDetailController = new ReadingDetailController(
  readingDetailService
);

export default (router: Router) => {
  const prefix = '/reading-details';

  router.get(prefix, readingDetailController.getReadingDetails);

  router.post(
    prefix,
    validate(createReadingDetailSchema),
    asyncHandler(readingDetailController.createReadingDetail)
  );

  router.get(
    `${prefix}/:detail_id`,
    validate(readingDetailParamsSchema),
    asyncHandler(readingDetailController.getReadingDetailById)
  );

  router.patch(
    `${prefix}/:detail_id`,
    validate(updateReadingDetailSchema),
    asyncHandler(readingDetailController.updateReadingDetail)
  );

  router.delete(
    `${prefix}/:detail_id`,
    validate(readingDetailParamsSchema),
    asyncHandler(readingDetailController.deleteReadingDetail)
  );
};
