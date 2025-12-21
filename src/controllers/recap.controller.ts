// src/controllers/recap.controller.ts

import type { Request, Response, NextFunction } from 'express';
import { Error401 } from '../utils/customError.js';
import { res200 } from '../utils/response.js';
import { recapService } from '../services/recap.service.js';

class RecapController {
  public getRecap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedData.query;
      const result = await recapService.getRecap(query);
      res200({ res, data: result, message: 'Rekap berhasil diambil.' });
    } catch (error) {
      next(error);
    }
  };

  public getMonthlyRecap = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const query = res.locals.validatedData.query;
      const result = await recapService.getMonthlyRecap(query);
      res200({ res, data: result, message: 'Rekap bulanan berhasil diambil.' });
    } catch (error) {
      next(error);
    }
  };

  public recalculateRecap = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // PERBAIKAN: Ambil user dari req.user dan tambahkan validasi.
      // `req.user` diisi oleh middleware `authMiddleware` atau `authorize`.
      const user = (req as any).user; // The user payload is attached by auth middleware
      if (!user || !user.id) {
        throw new Error401(
          'Data pengguna tidak ditemukan. Sesi mungkin tidak valid.'
        );
      }
      const { startDate, endDate, meterId } = res.locals.validatedData.body;

      // PERBAIKAN: Jangan `await`. Jalankan proses di latar belakang.
      recapService.recalculateSummaries(
        new Date(startDate),
        new Date(endDate),
        meterId,
        Number(user.id) // Ensure userId is a number
      );

      res200({
        res,
        message: 'Proses kalkulasi ulang telah dimulai di latar belakang.',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const recapController = new RecapController();
