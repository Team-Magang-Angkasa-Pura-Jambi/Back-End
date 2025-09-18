import type { Request, Response } from 'express';
import {
  electricityService,
  type ElectricityService,
} from '../services/Electricity.service.js';
import { res200, res201 } from '../utils/response.js';
import { Error400, Error404 } from '../utils/customError.js';
import type {
  CreateReadingSessionBody,
  IdParams,
} from '../types/electricity.type.js';

/**
 * Controller untuk menangani semua request HTTP yang berkaitan dengan data listrik.
 */
export class ElectricityController {
  constructor(private electricityService: ElectricityService) {}

  /**
   * Mengambil semua data pembacaan listrik.
   */
  public getAll = async (req: Request, res: Response) => {
    const readings = await this.electricityService.findAll();
    res200({
      res,
      message: 'Berhasil mengambil semua data listrik.',
      data: readings,
    });
  };

  /**
   * Mengambil satu data pembacaan listrik berdasarkan ID.
   */
  public getById = async (req: Request<IdParams>, res: Response) => {
    const sessionId = res.locals.validatedData.params.id;

    const reading = await this.electricityService.findById(sessionId);
    if (!reading) {
      throw new Error404(
        `Sesi pembacaan dengan ID ${sessionId} tidak ditemukan.`
      );
    }

    res200({
      res,
      message: 'Berhasil mengambil data sesi pembacaan.',
      data: reading,
    });
  };

  public getLatestForMeter = async (req: Request<IdParams>, res: Response) => {
    const meterId = parseInt(req.params.id, 10);
    if (isNaN(meterId)) {
      throw new Error400('ID meteran tidak valid.');
    }

    const latestReading =
      await this.electricityService.getLatestReadingForMeter(meterId);
    if (!latestReading) {
      throw new Error404(
        `Tidak ada data pembacaan untuk meteran dengan ID ${meterId}.`
      );
    }

    res200({
      res,
      message: 'Berhasil mengambil data pembacaan terakhir.',
      data: latestReading,
    });
  };
}
export const electricityController = new ElectricityController(
  electricityService
);
