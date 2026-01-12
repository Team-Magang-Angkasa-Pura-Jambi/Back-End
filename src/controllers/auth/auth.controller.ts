// src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import { res200 } from '../../utils/response.js';
import type { LoginBody } from '../../types/auth/auth.type.js';
import { authService, type AuthService } from '../../services/auth/auth.service.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  public login = async (req: Request<object, object, LoginBody>, res: Response) => {
    const result = await this.authService.login(req.body);
    res200({ res, message: 'Login Berhasil!', data: result });
  };
}

export const authController = new AuthController(authService);
