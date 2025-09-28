import { Router } from 'express';
import * as indexController from '../../../controllers/index.js';
import { authRoutes } from './auth.routes.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { meterRoutes } from './meter.routes.js';
import { energyTypeRoutes } from './energy.routes.js';
import { roleRoutes } from './role.routes.js';
import { readingRoutes } from './reading.routes.js';

import { readingTypeRoutes } from './readingType.route.js';
import readingDetailRoute from './readingDetail.route.js';
import priceSchemeRoute from './priceScheme.route.js';
import userRoute from './user.route.js';
import efficencyTargetRoute from './efficencyTarget.route.js';
import paxRoutes from './pax.routes.js';
import eventsLogBookRoutes from './eventsLogBook.routes.js';
import dailySummaryRoute from './dailySummary.route.js';
import summaryDetailRoute from './summaryDetail.route.js';
import analysisRoute from './analysis.route.js';
import SchemeRateRoute from './schemeRate.route.js';
import recapRoute from './recap.route.js';
import meterCategoryRoute from './meterCategory.route.js';
import taxRoute from './tax.route.js';

export default (app: any) => {
  const router = Router();

  app.use('/api/v1', router);
  router.get('/', indexController.index);

  authRoutes(router);

  router.use(authMiddleware);
  userRoute(router);

  meterRoutes(router);
  energyTypeRoutes(router);
  roleRoutes(router);
  readingRoutes(router);

  readingTypeRoutes(router);
  readingDetailRoute(router);
  priceSchemeRoute(router);
  efficencyTargetRoute(router);
  SchemeRateRoute(router);
  paxRoutes(router);
  eventsLogBookRoutes(router);
  dailySummaryRoute(router);
  summaryDetailRoute(router);
  analysisRoute(router);
  recapRoute(router);
  meterCategoryRoute(router);
  taxRoute(router);
};
