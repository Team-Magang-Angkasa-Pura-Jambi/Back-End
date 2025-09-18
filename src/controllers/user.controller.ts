import type { NextFunction, Request, Response } from 'express';
import { res200, res201 } from '../utils/response.js';

import { userService, type UserService } from '../services/user.service.js';
import { Error400 } from '../utils/customError.js';
import type { GetUsersQuery } from '../validations/user.validation.js';
import type {
  CreateUserBody,
  UpdateUserBody,
  UpdateUserParams,
} from '../types/auth.type.js';

export class UserController {
  constructor(private userService: UserService) {}

  public createUser = async (
    req: Request<{}, {}, CreateUserBody>,
    res: Response
  ) => {
    const data = res.locals.validatedData.body;
    const newUser = await this.userService.create(data);
    res201({ res, message: 'Berhasil menambahkan user baru.', data: newUser });
  };

  public getUsers = async (
    req: Request<{}, {}, {}, GetUsersQuery>,
    res: Response,
    next: NextFunction
  ) => {
    const result = await this.userService.findAll(res.locals.validatedData);
    res200({
      res,
      message: 'Berhasil mengambil semua data user.',
      data: result,
    });
  };

  public getActiveUsers = async (
    req: Request<{}, {}, {}, GetUsersQuery>,
    res: Response,
    next: NextFunction
  ) => {
    const result = await this.userService.findAllActive(
      res.locals.validatedData
    );
    res200({
      res,
      message: 'Berhasil mengambil semua data user Active.',
      data: result,
    });
  };

  public getUserProfile = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const userProfile = await this.userService.findById(userId);
    res200({
      res,
      message: 'Profil user berhasil diambil.',
      data: userProfile,
    });
  };

  public getUser = async (req: Request, res: Response) => {
    const id = res.locals.validatedData.params.userId;

    if (!id) {
      throw new Error400('ID Pengguna tidak valid!');
    }
    const userId = parseInt(id, 10);
    const userProfile = await this.userService.findById(userId);
    res200({
      res,
      message: 'Profil user berhasil diambil.',
      data: userProfile,
    });
  };

  public updateUser = async (
    req: Request<UpdateUserParams, {}, UpdateUserBody>,
    res: Response,
    next: NextFunction
  ) => {
    const userId = parseInt(req.params.userId, 10);

    const updatedUser = await this.userService.update(userId, req.body);

    res200({
      res,
      message: 'Berhasil mengupdate data user.',
      data: updatedUser,
    });
  };

  public deleteUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const id = res.locals.validatedData.params.userId;

    if (!id) {
      throw new Error400('ID Pengguna tidak valid!');
    }

    const deletedUser = await this.userService.delete(id);
    res200({
      res,
      message: 'Pengguna berhasil dinonaktifkan (soft delete).',
      data: deletedUser,
    });
  };
}
export const userController = new UserController(userService);
