import { type NextFunction, type Request, type Response } from 'express';
import { notificationsService } from './notifications.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const notificationsController = {
  show: async (req: Request, res: Response, next: NextFunction) => {
    const user_id = req.user?.id;

    if (!user_id) throw new Error404('User tidak ditemukan');

    const { query } = res.locals.validatedData;

    const data = await notificationsService.show(user_id, query);

    return res200({ res, message: 'Data Notifiakasi Ditemukan!', data });
  },

  store: async (req: Request, res: Response, next: NextFunction) => {
    const { body } = res.locals.validatedData;
    const data = await notificationsService.store(body);

    return res201({ res, message: 'Data Notifikasi Ditambahkan!', data });
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    const user_id = req.user?.id;

    if (!user_id) throw new Error404('User tidak ditemukan');

    const { params } = res.locals.validatedData;

    const notification_id = params.id;

    if (!notification_id) throw new Error404('ID tidak ditemukan');

    const data = await notificationsService.update(notification_id, user_id);

    return res200({ res, message: 'Data Notifikasi Diperbarui!', data });
  },

  bulkRead: async (req: Request, res: Response, next: NextFunction) => {
    const user_id = req.user?.id;

    if (!user_id) throw new Error404('User tidak ditemukan');

    const { body } = res.locals.validatedData;

    const data = await notificationsService.bulkRead(Number(user_id), body);

    return res201({ res, message: 'Data Notifikasi Diperbarui!', data });
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    const user_id = req.user?.id;
    if (!user_id) throw new Error404('User tidak ditemukan');

    const { params } = res.locals.validatedData;

    const notification_id = params.id;

    const data = await notificationsService.remove(notification_id, user_id);

    return res200({ res, message: 'Data Notifikasi Dihapus!', data });
  },

  removeMany: async (req: Request, res: Response, next: NextFunction) => {
    const user_id = req.user?.id;

    const { body } = res.locals.validatedData;

    const { ids } = body;

    const data = await notificationsService.removeMany(ids, Number(user_id));

    res200({ res, message: 'Data Notifikasi Dihapus!', data });
  },
};
