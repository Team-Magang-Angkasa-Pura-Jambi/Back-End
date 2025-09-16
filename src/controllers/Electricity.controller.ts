import type { Request, Response } from 'express';
import type { ElectricityService } from '../services/Electricity.service.js';
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
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      throw new Error400('ID sesi tidak valid.');
    }

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

  /**
   * Membuat data pembacaan listrik baru.
   */
  public create = async (
    req: Request<{}, {}, CreateReadingSessionBody>,
    res: Response
  ) => {
    const newReading = await this.electricityService.create(req.body);
    res201({
      res,
      message: 'Berhasil menambahkan data pembacaan baru.',
      data: newReading,
    });
  };

  /**
   * Membuat data koreksi untuk pembacaan yang sudah ada.
   */
  public createCorrection = async (
    req: Request<IdParams, {}, CreateReadingSessionBody>,
    res: Response
  ) => {
    const originalSessionId = parseInt(req.params.id, 10);
    if (isNaN(originalSessionId)) {
      throw new Error400('ID sesi orisinal tidak valid.');
    }

    const originalSession =
      await this.electricityService.findById(originalSessionId);
    if (!originalSession) {
      throw new Error404(
        `Sesi pembacaan dengan ID ${originalSessionId} yang akan dikoreksi tidak ditemukan.`
      );
    }

    const correctedReading = await this.electricityService.createCorrection(
      originalSessionId,
      req.body
    );
    res201({
      res,
      message: 'Berhasil menambahkan data koreksi.',
      data: correctedReading,
    });
  };

  /**
   * Menghapus data pembacaan listrik.
   */
  public delete = async (req: Request<IdParams>, res: Response) => {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      throw new Error400('ID sesi tidak valid.');
    }

    const existingReading = await this.electricityService.findById(sessionId);
    if (!existingReading) {
      throw new Error404(
        `Sesi pembacaan dengan ID ${sessionId} tidak ditemukan.`
      );
    }

    const deletedReading = await this.electricityService.delete(sessionId);
    res200({ res, message: 'Data berhasil dihapus.', data: deletedReading });
  };

  /**
   * Mendapatkan data pembacaan terakhir untuk sebuah meteran.
   */
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
