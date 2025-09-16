import { Router } from 'express';
import * as indexController from '../../../controllers/index.js';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './user.route.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { electricityRoutes } from './Electricity.routes.js';
import { meterRoutes } from './meter.routes.js';
import { energyTypeRoutes } from './energy.routes.js';

export default (app: any) => {
  const router = Router();

  app.use('/api/v1', router);
  router.get('/', indexController.index);

  authRoutes(router);
  router.use(authMiddleware);
  userRoutes(router);

  electricityRoutes(router);
  meterRoutes(router);
  energyTypeRoutes(router);
};
