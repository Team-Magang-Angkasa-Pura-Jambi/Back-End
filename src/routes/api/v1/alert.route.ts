import { Router } from 'express';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { alertController } from '../../../controllers/notifications/alert.controller.js';
import {
  alertIdParamSchema,
  emptySchema,
  // Asumsikan Anda telah membuat skema ini di file validasi
  bulkDeleteAlertsSchema,
  getAlertsSchema,
  getLatestAlertsSchema,
  updateAlertStatusSchema,
} from '../../../validations/notifications/alert.validation.js';

export default (router: Router) => {
  const prefix = '/alerts';

  router.get(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getAlertsSchema),
    asyncHandler(alertController.getAll)
  );

  // BARU: Endpoint untuk alert yang tidak terkait meter (sistem)
  router.get(
    `${prefix}/system`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getAlertsSchema),
    asyncHandler(alertController.getSystemAlerts)
  );

  // BARU: Endpoint untuk semua alert yang terkait meter
  router.get(
    `${prefix}/meters`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getAlertsSchema),
    asyncHandler(alertController.getMeterAlerts)
  );

  // BARU: Endpoint untuk mengambil beberapa alert terbaru
  router.get(
    `${prefix}/latest`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getLatestAlertsSchema),
    asyncHandler(alertController.getLatest)
  );

  router.get(
    `${prefix}/unread-count`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(emptySchema),
    asyncHandler(alertController.getUnreadCount)
  );

  router.patch(
    `${prefix}/acknowledge-all`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(emptySchema),
    asyncHandler(alertController.acknowledgeAll)
  );

  router.patch(
    `${prefix}/:alertId/acknowledge`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(alertIdParamSchema),
    asyncHandler(alertController.acknowledge)
  );

  // Endpoint yang sudah ada untuk update status
  router.patch(
    `${prefix}/:alertId/status`,
    authorize('Admin', 'SuperAdmin'),
    validate(updateAlertStatusSchema),
    asyncHandler(alertController.updateStatus)
  );

  // BARU: Endpoint untuk menghapus beberapa alert sekaligus
  router.post(
    `${prefix}/bulk-delete`,
    authorize('Admin', 'SuperAdmin'), // Hanya Admin dan SuperAdmin yang bisa hapus massal
    validate(bulkDeleteAlertsSchema),
    asyncHandler(alertController.bulkDelete)
  );
};
