import { Router } from 'express';
import { root } from '../../../modules/root/index.js';
import { usersRoute } from '../../../modules/users/users.route.js';
import { rolesRoute } from '../../../modules/roles/roles.route.js';
import { authRoute } from '../../../modules/auth/auth.route.js';
import { energiesRoute } from '../../../modules/energies/energies.route.js';
import { readingTypesRoute } from '../../../modules/reading-types/reading-types.route.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { locationsRoute } from '../../../modules/locations/locations.route.js';
import { auditContextMiddleware } from '../../../common/utils/auditContext.js';
import { tenantsRoute } from '../../../modules/tenants/tenants.route.js';
import { auditLogsRouter } from '../../../modules/audit-log/audit-log.route.js';
import { notificationsRouter } from '../../../modules/notifications/notifications.route.js';
import { efficiencyRoute } from '../../../modules/efficiency_targets/efficiency_targets.route.js';
import { metersRoute } from '../../../modules/meters/meters.route.js';
import { meterConfigsRoute } from '../../../modules/meter_reading_configs/meter_reading_configs.route.js';
import { templateRoute } from '../../../modules/calculation_templates/calculation_templates.route.js';
import { formulaRoute } from '../../../modules/formula_definitions/formula_definitions.route.js';
import { priceSchemeRoute } from '../../../modules/price_schemes/price_schemes.route.js';

export default (app: any) => {
  const router = Router();

  app.use('/api/v2', router);
  router.get('/', root);
  // root(router);
  authRoute(router);

  router.use(authMiddleware);
  router.use(auditContextMiddleware);

  usersRoute(router);
  rolesRoute(router);
  energiesRoute(router);
  readingTypesRoute(router);
  locationsRoute(router);

  tenantsRoute(router);

  auditLogsRouter(router);

  notificationsRouter(router);

  efficiencyRoute(router);

  metersRoute(router);

  meterConfigsRoute(router);

  templateRoute(router);

  formulaRoute(router);
  priceSchemeRoute(router);
};
