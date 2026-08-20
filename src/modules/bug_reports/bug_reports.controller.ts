import { type Request, type Response } from 'express';
import { bugReportService } from './bug_reports.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404, Error403 } from '../../utils/customError.js';

export const bugReportController = {
  store: async (req: Request, res: Response) => {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    const { body } = res.locals.validatedData;

    const data = await bugReportService.store(body, userId);

    return res201({
      res,
      message: 'Laporan bug berhasil dikirim ke developer. Terima kasih atas masukan Anda!',
      data,
    });
  },

  show: async (req: Request, res: Response) => {
    const { params, query } = res.locals.validatedData;

    if (params?.id) {
      const result = await bugReportService.show(params.id);
      if (!result) throw new Error404('Laporan bug tidak ditemukan');
      return res200({ res, message: 'Detail Laporan Bug', data: result });
    }

    const result = await bugReportService.show(undefined, query);
    const listResult = result as unknown as { data: any[]; summary: any; meta: any };

    return res200({
      res,
      message: 'Daftar Laporan Bug & Pengaduan',
      data: listResult.data,
      meta: {
        ...listResult.meta,
        summary: listResult.summary,
      },
    });
  },

  updateStatus: async (req: Request, res: Response) => {
    const { params, body } = res.locals.validatedData;
    const { id } = params;

    const existing = await bugReportService.show(id);
    if (!existing) throw new Error404('Laporan bug tidak ditemukan');

    const data = await bugReportService.updateStatus(id, body);

    return res200({
      res,
      message: `Status laporan bug berhasil diperbarui menjadi ${body.status}`,
      data,
    });
  },

  remove: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    const { id } = params;

    const existing = await bugReportService.show(id);
    if (!existing) throw new Error404('Laporan bug tidak ditemukan');

    await bugReportService.remove(id);

    return res200({ res, message: 'Laporan bug berhasil dihapus' });
  },
};
