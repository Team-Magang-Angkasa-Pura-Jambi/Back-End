import { Router } from 'express';
import { systemConfigController } from './system_config.controller.js';
import { validate } from '../../utils/validate.js';
import {
  updateSystemConfigSchema,
  testMlSchema,
  testWeatherSchema,
  importPackageSchema,
} from './system_config.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const systemConfigRoute = (router: Router) => {
  const prefix = '/system-config';

  router.get(prefix, asyncHandler(systemConfigController.getConfig));

  router.put(
    prefix,
    validate(updateSystemConfigSchema),
    asyncHandler(systemConfigController.updateConfig),
  );

  router.post(
    `${prefix}/test-ml`,
    validate(testMlSchema),
    asyncHandler(systemConfigController.testMl),
  );

  router.post(
    `${prefix}/test-weather`,
    validate(testWeatherSchema),
    asyncHandler(systemConfigController.testWeather),
  );

  router.get(
    `${prefix}/export-package`,
    asyncHandler(systemConfigController.exportPackage),
  );

  router.post(
    `${prefix}/import-package`,
    validate(importPackageSchema),
    asyncHandler(systemConfigController.importPackage),
  );
};
