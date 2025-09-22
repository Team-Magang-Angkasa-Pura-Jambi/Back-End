import type { NextFunction, Request, Response } from 'express';
import type { ReadingDetailService } from '../services/readingDetail.service.js';

import { res200, res201 } from '../utils/response.js';
import type {
  ReadingDetailParams,
  UpdateReadingDetailInput,
} from '../types/readingDetail.type.js';

export class ReadingDetailController {
  constructor(private readingDetailService: ReadingDetailService) {}

  /**
   * Mengambil semua reading details.
   */
  public getReadingDetails = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const result = await this.readingDetailService.findAll();
    res200({
      res,
      message: 'Berhasil mengambil semua data.',
      data: result,
    });
  };

  /**
   * Mengambil satu reading detail berdasarkan ID.
   */
  public getReadingDetailById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const params = res.locals.validatedData.params.detail_id;

    const result = await this.readingDetailService.findById(params);
    res200({
      res,
      message: 'Berhasil mengambil data.',
      data: result,
    });
  };

  /**
   * BARU: Membuat reading detail baru.
   */
  public createReadingDetail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const body = res.locals.validatedData.body;
    const result = await this.readingDetailService.create(body);

    res201({
      res,
      message: 'Berhasil membuat data baru.',
      data: result,
    });
  };

  /**
   * BARU: Memperbarui reading detail.
   */
  public updateReadingDetail = async (
    req: Request<ReadingDetailParams, {}, UpdateReadingDetailInput>,
    res: Response,
    next: NextFunction
  ) => {
    const params = parseInt(req.params.detail_id, 10);

    const body = res.locals.validatedData.body;

    const result = await this.readingDetailService.update(params, body);
    res200({
      res,
      message: 'Berhasil memperbarui data.',
      data: result,
    });
  };

  /**
   * BARU: Menghapus reading detail.
   */
  public deleteReadingDetail = async (
    req: Request<ReadingDetailParams, {}, {}>,
    res: Response,
    next: NextFunction
  ) => {
    const params = parseInt(req.params.detail_id, 10);

    await this.readingDetailService.delete(params);

    res200({
      res,
      message: 'Berhasil menghapus data.',
    });
  };
}
