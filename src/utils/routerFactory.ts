import { Router } from 'express';
import { validate } from './validate.js';
import { asyncHandler } from './asyncHandler.js';
import { authorize } from '../middleware/auth.middleware.js';
import type { ZodObject } from 'zod';
import type { RoleName } from '../generated/prisma/index.js';

interface CrudRouterOptions {
  ServiceClass: new () => any;
  ControllerClass: new (service: any) => any;
  idParamName: string;
  schemas: {
    create: ZodObject<any>;
    update: ZodObject<any>;
    params: ZodObject<any>;
    getAll?: ZodObject<any>;
  };
  authorizations?: Partial<Record<CrudAction, RoleName[]>>;
  handlerNames?: Partial<Record<CrudAction, string>>;
}

type CrudAction = 'getAll' | 'getById' | 'create' | 'update' | 'delete';

export const createCrudRouter = (
  prefix: string,
  options: CrudRouterOptions
) => {
  const router = Router();
  const {
    ServiceClass,
    ControllerClass,
    idParamName,
    schemas,
    authorizations = {},
    handlerNames = {},
  } = options;

  const service = new ServiceClass();
  const controller = new ControllerClass(service);

  const buildRoute = (
    action: CrudAction,
    path: string,
    method: 'get' | 'post' | 'patch' | 'delete',
    schema?: ZodObject<any>
  ) => {
    const middlewares: any[] = [];

    if (authorizations[action]) {
      middlewares.push(authorize(...authorizations[action]!));
    }
    if (schema) {
      middlewares.push(validate(schema));
    }

    const handlerName = handlerNames[action] ?? action;
    const handler = controller[handlerName].bind(controller);

    (router as any)[method](path, ...middlewares, asyncHandler(handler));
  };

  // 🔹 Define CRUD routes
  buildRoute('getAll', prefix, 'get', schemas.getAll);
  buildRoute('create', prefix, 'post', schemas.create);
  buildRoute('getById', `${prefix}/:${idParamName}`, 'get', schemas.params);
  buildRoute('update', `${prefix}/:${idParamName}`, 'patch', schemas.update);
  buildRoute('delete', `${prefix}/:${idParamName}`, 'delete', schemas.params);

  return router;
};
