import { Router } from 'express';
import * as indexController from '../../../controllers/index.js';
import { authRoutes } from './auth.routes.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { meterRoutes } from './meter.routes.js';
import { energyTypeRoutes } from './energy.routes.js';
import { roleRoutes } from './role.routes.js';
import { readingRoutes } from './reading.routes.js';
import { summaryRoutes } from './summary.routes.js';
import { chartRoutes } from './chart.routes.js';
import { readingTypeRoutes } from './readingType.route.js';
import readingDetailRoute from './readingDetail.route.js';
import priceSchemeRoute from './priceScheme.route.js';
// import efficencyTargetRoute from './efficencyTarget.route.js';
import userRoute from './user.route.js';

export default (app: any) => {
  const router = Router();

  app.use('/api/v1', router);
  router.get('/', indexController.index);

  authRoutes(router);
  summaryRoutes(router);
  router.use(authMiddleware);
  userRoute(router);

  meterRoutes(router);
  energyTypeRoutes(router);
  roleRoutes(router);
  readingRoutes(router);
  chartRoutes(router);
  readingTypeRoutes(router);
  readingDetailRoute(router);
  priceSchemeRoute(router);
  // efficencyTargetRoute(router);
};
