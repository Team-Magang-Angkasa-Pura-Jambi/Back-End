import { Router, Application } from 'express';

import { root } from '../../../modules/root/index.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { auditContextMiddleware } from '../../../common/utils/auditContext.js';

import { usersRoute } from '../../../modules/users/users.route.js';
import { rolesRoute } from '../../../modules/roles/roles.route.js';
import { authRoute } from '../../../modules/auth/auth.route.js';
import { energiesRoute } from '../../../modules/energies/energies.route.js';
import { readingTypesRoute } from '../../../modules/reading-types/reading-types.route.js';
import { locationsRoute } from '../../../modules/locations/locations.route.js';
import { tenantsRoute } from '../../../modules/tenants/tenants.route.js';
import { auditLogsRouter } from '../../../modules/audit-log/audit-log.route.js';
import { notificationsRouter } from '../../../modules/notifications/notifications.route.js';
import { efficiencyRoute } from '../../../modules/efficiency_targets/efficiency_targets.route.js';
import { metersRoute } from '../../../modules/meters/meters.route.js';
import { meterConfigsRoute } from '../../../modules/meter_reading_configs/meter_reading_configs.route.js';
import { templateRoute } from '../../../modules/calculation_templates/calculation_templates.route.js';
import { formulaRoute } from '../../../modules/formula_definitions/formula_definitions.route.js';
import { priceSchemeRoute } from '../../../modules/price_schemes/price_schemes.route.js';
import { budgetRoute } from '../../../modules/annual_budgets/annual_budgets.route.js';
import { readingRoute } from '../../../modules/reading_sessions/reading_sessions.route.js';
import { dailySummaryRoute } from '../../../modules/daily_summaries/daily_summaries.route.js';
import { visualizationRoute } from '../../../modules/visualization/visualization.route.js';
import { paxRouter } from '../../../modules/pax/pax.route.js';
import { evaluationRouter } from '../../../modules/evalution/evalution.route.js';
import { predictionRoute } from '../../../modules/predictions/predictions.route.js';
import { systemConfigRoute } from '../../../modules/system_config/system_config.route.js';
import { systemMonitorRoute } from '../../../modules/system_monitor/system_monitor.route.js';
import { bugReportRoute } from '../../../modules/bug_reports/bug_reports.route.js';
import { aiAgentRoute } from '../../../modules/ai_agent/ai_agent.route.js';
import { pageGuidesRoute } from '../../../modules/page_guides/page_guides.route.js';
import { menusRoute } from '../../../modules/menus/menus.route.js';

export default (app: Application) => {
  const router = Router();
  app.use('/api/v2', router);

  router.get('/', root);
  authRoute(router);
  aiAgentRoute(router);

  router.use(authMiddleware);
  router.use(auditContextMiddleware);

  const protectedRoutes = [
    usersRoute,
    rolesRoute,
    energiesRoute,
    readingTypesRoute,
    locationsRoute,
    tenantsRoute,
    auditLogsRouter,
    notificationsRouter,
    efficiencyRoute,
    metersRoute,
    meterConfigsRoute,
    templateRoute,
    formulaRoute,
    priceSchemeRoute,
    budgetRoute,
    // allocationRoute,
    readingRoute,
    dailySummaryRoute,
    visualizationRoute,
    paxRouter,
    evaluationRouter,
    predictionRoute,
    systemConfigRoute,
    systemMonitorRoute,
    bugReportRoute,
    pageGuidesRoute,
    menusRoute,
  ];

  protectedRoutes.forEach((route) => route(router));
};
