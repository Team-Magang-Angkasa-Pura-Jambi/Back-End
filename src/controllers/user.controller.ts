// src/controllers/user.controller.ts

import type { Request, Response } from 'express';
import { res200 } from '../utils/response.js';
import { UserService } from '../services/user.service.js';
import type { User } from '../generated/prisma/index.js';
import { BaseController } from '../utils/baseController.js';
import type {
  CreateUserBody,
  GetUsersQuery,
  UpdateUserBody,
} from '../types/user.type.js'; // Disarankan import dari file schema

export class UserController extends BaseController<
  User,
  CreateUserBody,
  UpdateUserBody,
  GetUsersQuery, // <-- [FIX] Tambahkan tipe query
  UserService
> {
  constructor() {
    super(new UserService(), 'userId');
  }

  /**
   * @override
   * [FIX] Meng-override method 'delete' dari base class untuk menjalankan
   * logika soft delete yang spesifik untuk User.
   */
  public override delete = async (req: Request, res: Response) => {
    const { userId } = res.locals.validatedData.params;
    if (!this.service.softDelete) {
      throw new Error('Metode softDelete tidak tersedia pada service ini.');
    }

    const deletedUser = await this.service.softDelete(userId);

    res200({
      res,
      message: 'Pengguna berhasil dinonaktifkan (soft delete).',
      data: deletedUser,
    });
  };
}
