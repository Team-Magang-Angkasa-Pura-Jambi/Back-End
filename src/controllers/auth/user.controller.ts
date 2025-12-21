import type { Request, Response } from 'express';
import { res200 } from '../../utils/response.js';
import type { User } from '../../generated/prisma/index.js';
import { BaseController } from '../../utils/baseController.js';
import type {
  CreateUserBody,
  GetUsersQuery,
  UpdateUserBody,
} from '../../types/auth/user.type.js';
import { userService, UserService } from '../../services/auth/user.service.js';

export class UserController extends BaseController<
  User,
  CreateUserBody,
  UpdateUserBody,
  GetUsersQuery,
  UserService
> {
  constructor() {
    super(userService, 'userId');
  }

  /**
   * BARU: Controller untuk mengambil riwayat aktivitas pengguna.
   */
  public getActivityHistory = async (req: Request, res: Response) => {
    const { userId } = res.locals.validatedData.params;

    const result = await this.service.getActivityHistory(userId);

    res200({
      res,
      message: 'Riwayat aktivitas pengguna berhasil diambil.',
      data: result,
    });
  };
}

export const userController = new UserController();
