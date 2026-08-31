import { type Request, type Response } from 'express';
import { pageGuidesService } from './page_guides.service.js';
import { res200 } from '../../utils/response.js';

export const pageGuidesController = {
  index: async (req: Request, res: Response) => {
    const data = await pageGuidesService.getAll();
    return res200({ res, message: 'Berhasil mengambil semua panduan halaman', data });
  },

  show: async (req: Request, res: Response) => {
    const { query } = res.locals.validatedData;
    const data = await pageGuidesService.getByRoute(query.route);
    return res200({ res, message: 'Berhasil mengambil panduan', data });
  },

  patch: async (req: Request, res: Response) => {
    const { params, body } = res.locals.validatedData;
    const guide_id = Number(params.id);
    const updated_by = req.user!.user_id;

    // Convert to Prisma.JsonValue if defined
    const dataToUpdate: any = { ...body };
    if (body.workflow) dataToUpdate.workflow = body.workflow;
    if (body.buttons) dataToUpdate.buttons = body.buttons;
    if (body.tips) dataToUpdate.tips = body.tips;

    const data = await pageGuidesService.update(guide_id, dataToUpdate, updated_by);
    return res200({ res, message: 'Berhasil memperbarui panduan halaman', data });
  },

  store: async (req: Request, res: Response) => {
    const { body } = res.locals.validatedData;
    const created_by = req.user!.user_id;

    const data = await pageGuidesService.create(body, created_by);
    return res200({ res, message: 'Berhasil menambahkan panduan halaman', data });
  },

  destroy: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    const guide_id = Number(params.id);

    const data = await pageGuidesService.delete(guide_id);
    return res200({ res, message: 'Berhasil menghapus panduan halaman', data });
  },
};
