import type { Request, Response } from 'express';
import type { ReadingTypeService } from '../services/readingType.service.js';
import { res200, res201 } from '../utils/response.js';
import type { IdParams } from '../types/reading.types.js';
import type {
  CreateReadingTypeInput,
  UpdateReadingTypeInput,
} from '../types/readingType.type.js';

/**
 * Controller untuk menangani request HTTP terkait Tipe Pembacaan.
 */
export class ReadingTypeController {
  constructor(private readingTypeService: ReadingTypeService) {}

  public getAllReadingTypes = async (req: Request, res: Response) => {
    const readingTypes = await this.readingTypeService.findAll();
    res200({
      res,
      message: 'Berhasil mengambil semua data tipe pembacaan.',
      data: readingTypes,
    });
  };

  public getReadingTypeById = async (req: Request<IdParams>, res: Response) => {
    const readingTypeId = req.params.id;
    const readingType = await this.readingTypeService.findById(readingTypeId);
    res200({
      res,
      message: 'Data tipe pembacaan berhasil ditemukan.',
      data: readingType,
    });
  };

  public createReadingType = async (
    req: Request<{}, {}, CreateReadingTypeInput>,
    res: Response
  ) => {
    const newReadingType = await this.readingTypeService.create(req.body);
    res201({
      res,
      message: 'Tipe pembacaan baru berhasil dibuat.',
      data: newReadingType,
    });
  };

  public updateReadingType = async (
    req: Request<IdParams, {}, UpdateReadingTypeInput>,
    res: Response
  ) => {
    const readingTypeId = req.params.id;
    const updatedReadingType = await this.readingTypeService.update(
      readingTypeId,
      req.body
    );
    res200({
      res,
      message: 'Data tipe pembacaan berhasil diperbarui.',
      data: updatedReadingType,
    });
  };

  public deleteReadingType = async (req: Request<IdParams>, res: Response) => {
    const readingTypeId = req.params.id;
    const deletedReadingType =
      await this.readingTypeService.delete(readingTypeId);
    res200({
      res,
      message: 'Tipe pembacaan berhasil dihapus.',
      data: deletedReadingType,
    });
  };
}
