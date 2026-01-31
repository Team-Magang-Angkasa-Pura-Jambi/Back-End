import { Router } from 'express';
import * as indexController from '../../../controllers/index.js';
import { authRoutes } from './auth.routes.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { meterRoutes } from './meter.routes.js';
import { energyTypeRoutes } from './energy.routes.js';
import { roleRoutes } from './role.routes.js';

import { readingTypeRoutes } from './readingType.route.js';
import priceSchemeRoute from './priceScheme.route.js';
import userRoute from './user.route.js';
import efficencyTargetRoute from './efficencyTarget.route.js';
import paxRoutes from './pax.routes.js';
import dailySummaryRoute from './dailySummary.route.js';
import summaryDetailRoute from './summaryDetail.route.js';
import analysisRoute from './analytics.route.js';
import SchemeRateRoute from './schemeRate.route.js';
import recapRoute from './recap.route.js';
import meterCategoryRoute from './meterCategory.route.js';
import taxRoute from './tax.route.js';
import notificationRoute from './notification.route.js';
import TariffGroupRoute from './TariffGroup.route.js';
import machineLearningRoute from './machineLearning.route.js';
import alertRoute from './alert.route.js';
import dailyLogbookRoute from './dailyLogbook.route.js';
import budgetRoute from './budget.route.js';
import annualBudgetRoute from './annualBudget.route.js';
import readingRoutes from './reading.routes.js';
import visualizationsRoute from './visualizations.route.js';
import classifyRoute from './classify.route.js';
import predictRoute from './predict.route.js';

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
  priceSchemeRoute(router);
  efficencyTargetRoute(router);
  SchemeRateRoute(router);
  paxRoutes(router);
  dailySummaryRoute(router);
  summaryDetailRoute(router);
  analysisRoute(router);
  recapRoute(router);
  meterCategoryRoute(router);
  taxRoute(router);
  notificationRoute(router);
  TariffGroupRoute(router);
  machineLearningRoute(router);
  dailyLogbookRoute(router);
  alertRoute(router);
  budgetRoute(router);
  annualBudgetRoute(router);

  visualizationsRoute(router);

  classifyRoute(router);
  predictRoute(router);
};
