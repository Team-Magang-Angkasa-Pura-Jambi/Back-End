import { Router } from 'express';
import { root } from '../../../modules/root/index.js';
import { usersRoute } from '../../../modules/users/users.route.js';
import { rolesRoute } from '../../../modules/roles/roles.route.js';
import { authRoute } from '../../../modules/auth/auth.route.js';
import { energiesRoute } from '../../../modules/energies/energies.route.js';

export default (app: any) => {
  const router = Router();

  app.use('/api/v2', router);
  router.get('/', root);
  // root(router);
  usersRoute(router);
  rolesRoute(router);
  authRoute(router);
  energiesRoute(router);
};
