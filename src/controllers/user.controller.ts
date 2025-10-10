import type { Request, Response } from 'express';
import { res200 } from '../utils/response.js';
import type { User } from '../generated/prisma/index.js';
import { BaseController } from '../utils/baseController.js';
import type {
  CreateUserBody,
  GetUsersQuery,
  UpdateUserBody,
} from '../types/user.type.js';
import { UserService } from '../services/user.service.js';

export class UserController extends BaseController<
  User,
  CreateUserBody,
  UpdateUserBody,
  GetUsersQuery,
  UserService
> {
  constructor() {
    super(new UserService(), 'userId');
  }

  // public override delete = async (req: Request, res: Response) => {
  //   const { userId } = res.locals.validatedData.params;
  //   if (!this.service.softDelete) {
  //     throw new Error('Metode softDelete tidak tersedia pada service ini.');
  //   }

  //   const deletedUser = await this.service.softDelete(userId);

  //   res200({
  //     res,
  //     message: 'Pengguna berhasil dinonaktifkan (soft delete).',
  //     data: deletedUser,
  //   });
  // };
}
