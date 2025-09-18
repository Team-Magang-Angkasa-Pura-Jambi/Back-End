import type { Request, Response } from 'express';
import { roleService, type RoleService } from '../services/role.service.js';
import { res200, res201 } from '../utils/response.js';
import { Error404 } from '../utils/customError.js';
import type { CreateRoleInput, UpdateRoleInput } from '../types/role.type.js';

/**
 * Controller untuk menangani request HTTP terkait Peran.
 */
export class RoleController {
  constructor(private roleService: RoleService) {}

  public getAllRoles = async (req: Request, res: Response) => {
    const roles = await this.roleService.findAll();
    res200({ res, message: 'Semua data peran berhasil diambil.', data: roles });
  };

  public getRoleById = async (req: Request, res: Response) => {
    const roleId = parseInt(req.params.id, 10);
    const role = await this.roleService.findById(roleId);
    if (!role) {
      throw new Error404(`Peran dengan ID ${roleId} tidak ditemukan.`);
    }
    res200({ res, message: 'Data peran berhasil ditemukan.', data: role });
  };

  public createRole = async (
    req: Request<{}, {}, CreateRoleInput>,
    res: Response
  ) => {
    const newRole = await this.roleService.create(req.body);
    res201({ res, message: 'Peran baru berhasil dibuat.', data: newRole });
  };

  public updateRole = async (
    req: Request<{ id: string }, {}, UpdateRoleInput>,
    res: Response
  ) => {
    const roleId = parseInt(req.params.id, 10);
    const updatedRole = await this.roleService.update(roleId, req.body);
    res200({
      res,
      message: 'Data peran berhasil diperbarui.',
      data: updatedRole,
    });
  };

  public deleteRole = async (req: Request, res: Response) => {
    const roleId = parseInt(req.params.id, 10);
    const deletedRole = await this.roleService.delete(roleId);
    res200({ res, message: 'Peran berhasil dihapus.', data: deletedRole });
  };
}
export const roleController = new RoleController(roleService);
