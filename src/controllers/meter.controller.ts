import type { Request, Response } from 'express';
import type { MeterService } from '../services/meter.service.js';
import type {
  CreateMeterBody,
  IdParams,
  UpdateMeterBody,
} from '../types/meter.tpye.js';
import { Error400, Error404 } from '../utils/customError.js';
import { res200, res201 } from '../utils/response.js';
import prisma from '../configs/db.js';

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

  public getAllActive = async (req: Request, res: Response) => {
    const meters = await this.meterService.findAllActive();
    res200({
      res,
      message: 'Berhasil mengambil semua data meteran Active.',
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
    const { id: meterId } = res.locals.validatedData.params;
    const { energy_type_id: newEnergyTypeId } = res.locals.validatedData.body;

    const existingMeter = await this.meterService.findById(meterId);
    if (!existingMeter) {
      throw new Error404(`Meteran dengan ID ${meterId} tidak ditemukan.`);
    }

    if (newEnergyTypeId) {
      const targetEnergyType = await prisma.energyType.findUnique({
        where: {
          energy_type_id: newEnergyTypeId,
        },
      });

      if (!targetEnergyType) {
        throw new Error404(
          `Tipe energi dengan ID ${newEnergyTypeId} tidak ditemukan.`
        );
      }

      if (!targetEnergyType.is_active) {
        throw new Error400(
          `Tipe energi dengan ID ${newEnergyTypeId} sedang tidak aktif.`
        );
      }
    }

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

    const existingMeter = await this.meterService.findById(meterId);
    if (!existingMeter) {
      throw new Error404(`Meteran dengan ID ${meterId} tidak ditemukan.`);
    }

    const deletedMeter = await this.meterService.delete(meterId);
    res200({ res, message: 'Meteran berhasil dihapus.', data: deletedMeter });
  };
}
