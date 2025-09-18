import type { Request, Response } from 'express';
import type {
  CreateEnergyTypeBody,
  EnergyTypeParams,
  UpdateEnergyTypeBody,
} from '../types/energy.type.js';
import { res200, res201 } from '../utils/response.js';
import { Error400 } from '../utils/customError.js';
import { energyTypeService, type EnergyTypeService } from '../services/energy.service.js';

/**
 * Controller untuk menangani request HTTP terkait Jenis Energi.
 */
export class EnergyTypeController {
  constructor(private energyTypeService: EnergyTypeService) {}

  public createEnergyType = async (
    req: Request<{}, {}, CreateEnergyTypeBody>,
    res: Response
  ) => {
    const newEnergyType = await this.energyTypeService.create(req.body);
    res201({
      res,
      message: 'Berhasil menambahkan jenis energi baru.',
      data: newEnergyType,
    });
  };

  public getAllEnergyTypes = async (req: Request, res: Response) => {
    const energyTypes = await this.energyTypeService.findAll();
    res200({
      res,
      message: 'Berhasil mengambil semua data jenis energi.',
      data: energyTypes,
    });
  };
  public getAllActiveEnergyTypes = async (req: Request, res: Response) => {
    const energyTypes = await this.energyTypeService.findAllActive();
    res200({
      res,
      message: 'Berhasil mengambil semua data jenis energi yang active',
      data: energyTypes,
    });
  };

  public getEnergyTypeById = async (
    req: Request<EnergyTypeParams>,
    res: Response
  ) => {
    const energyTypeId = parseInt(req.params.id, 10);
    if (isNaN(energyTypeId)) {
      throw new Error400('ID jenis energi tidak valid.');
    }

    const energyType = await this.energyTypeService.findById(energyTypeId);
    res200({
      res,
      message: 'Berhasil mengambil data jenis energi.',
      data: energyType,
    });
  };

  public updateEnergyType = async (
    req: Request<EnergyTypeParams, {}, UpdateEnergyTypeBody>,
    res: Response
  ) => {
    const energyTypeId = parseInt(req.params.id, 10);
    if (isNaN(energyTypeId)) {
      throw new Error400('ID jenis energi tidak valid.');
    }

    const updatedEnergyType = await this.energyTypeService.update(
      energyTypeId,
      req.body
    );
    res200({
      res,
      message: 'Berhasil memperbarui data jenis energi.',
      data: updatedEnergyType,
    });
  };

  public deleteEnergyType = async (
    req: Request<EnergyTypeParams>,
    res: Response
  ) => {
    const energyTypeId = parseInt(req.params.id, 10);
    if (isNaN(energyTypeId)) {
      throw new Error400('ID jenis energi tidak valid.');
    }

    const deletedEnergyType = await this.energyTypeService.delete(energyTypeId);
    res200({
      res,
      message: 'Berhasil menghapus jenis energi.',
      data: deletedEnergyType,
    });
  };
}
export const energyTypeController = new EnergyTypeController(energyTypeService);
