import type { Request, Response } from 'express';
import { res200 } from '../utils/response.js';
import { dailyLogbookService } from '../services/dailyLogbook.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class DailyLogbookController {
  /**
   * Mengambil daftar logbook harian.
   */
  public getAll = asyncHandler(async (req: Request, res: Response) => {
    const query = res.locals.validatedData.query;
    const result = await dailyLogbookService.findAll(query);

    res200({
      res,
      message: 'Data logbook harian berhasil diambil.',
      data: result.data,
      meta: result.meta,
    });
  });

  /**
   * Mengambil satu logbook harian berdasarkan ID.
   */
  public getById = asyncHandler(async (req: Request, res: Response) => {
    const { logId } = res.locals.validatedData.params;
    const result = await dailyLogbookService.findById(logId);
    res200({ res, message: 'Data logbook berhasil diambil.', data: result });
  });

  /**
   * Memicu pembuatan logbook harian untuk tanggal tertentu (atau hari ini jika tidak dispesifikkan).
   */
  public generateLog = asyncHandler(async (req: Request, res: Response) => {
    // Ambil tanggal dari body yang sudah divalidasi.
    const { date } = res.locals.validatedData.body;

    const result = await dailyLogbookService.generateDailyLog(new Date(date));

    res200({
      res,
      message: 'Logbook harian berhasil dibuat.',
      data: result,
    });
  });
}

export const dailyLogbookController = new DailyLogbookController();
