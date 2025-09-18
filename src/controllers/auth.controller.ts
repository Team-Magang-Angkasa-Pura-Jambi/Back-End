import type { Request, Response } from 'express';
import { res200 } from '../utils/response.js';
import { authService, type AuthService } from '../services/auth.service.js';
import type { LoginBody } from '../types/auth.type.js';

export class AuthController {
  constructor(private authService: AuthService) {}

  public login = async (req: Request<{}, {}, LoginBody>, res: Response) => {
    const result = await this.authService.login(req.body);
    res200({ res, message: 'Login Berhasil!', data: result });
  };
}

export const authController = new AuthController(authService);
