import type { Request, Response } from 'express';
import type { MeterService } from '../services/meter.service.js';
import type {
  CreateMeterBody,
  IdParams,
  UpdateMeterBody,
} from '../types/meter.tpye.js';
import { Error400, Error404 } from '../utils/customError.js';
import { res200, res201 } from '../utils/response.js';

/**
 * Controller untuk menangani request HTTP terkait data meteran.
 */
export class MeterController {
  constructor(private meterService: MeterService) {}

  public getAll = async (req: Request, res: Response) => {
    const meters = await this.meterService.findAll();
    res200({
      res,
      message: 'Berhasil mengambil semua data meteran.',
      data: meters,
    });
  };

  public getById = async (req: Request<IdParams>, res: Response) => {
    const meterId = parseInt(req.params.id, 10);
    if (isNaN(meterId)) throw new Error400('ID meteran tidak valid.');

    const meter = await this.meterService.findById(meterId);
    if (!meter)
      throw new Error404(`Meteran dengan ID ${meterId} tidak ditemukan.`);

    res200({ res, message: 'Berhasil mengambil data meteran.', data: meter });
  };

  public create = async (
    req: Request<{}, {}, CreateMeterBody>,
    res: Response
  ) => {
    const newMeter = await this.meterService.create(req.body);
    res201({
      res,
      message: 'Berhasil menambahkan meteran baru.',
      data: newMeter,
    });
  };

  public update = async (
    req: Request<IdParams, {}, UpdateMeterBody>,
    res: Response
  ) => {
    const meterId = parseInt(req.params.id, 10);
    if (isNaN(meterId)) throw new Error400('ID meteran tidak valid.');

    // Pastikan data ada sebelum diupdate
    const existingMeter = await this.meterService.findById(meterId);
    if (!existingMeter)
      throw new Error404(`Meteran dengan ID ${meterId} tidak ditemukan.`);

    const updatedMeter = await this.meterService.update(meterId, req.body);
    res200({
      res,
      message: 'Berhasil memperbarui data meteran.',
      data: updatedMeter,
    });
  };

  public delete = async (req: Request<IdParams>, res: Response) => {
    const meterId = parseInt(req.params.id, 10);
    if (isNaN(meterId)) throw new Error400('ID meteran tidak valid.');

    // Pastikan data ada sebelum dihapus
    const existingMeter = await this.meterService.findById(meterId);
    if (!existingMeter)
      throw new Error404(`Meteran dengan ID ${meterId} tidak ditemukan.`);

    const deletedMeter = await this.meterService.delete(meterId);
    res200({ res, message: 'Meteran berhasil dihapus.', data: deletedMeter });
  };
}
