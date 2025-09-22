// src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import { res200 } from '../utils/response.js';
import type { LoginBody } from '../types/auth.type.js';
import { authService, type AuthService } from '../services/auth.service.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint login
   */
  public login = async (req: Request<{}, {}, LoginBody>, res: Response) => {
    const result = await this.authService.login(req.body);
    res200({ res, message: 'Login Berhasil!', data: result });
  };

  /**
   * Endpoint whoami
   */
  public whoami = async (req: Request, res: Response) => {
    // anggap userId sudah diinject ke req oleh middleware JWT
    const userId = (req as any).user?.id;
    const result = await this.authService.whoami(userId);
    res200({ res, message: 'Data pengguna berhasil diambil', data: result });
  };
}

// ✅ export singleton controller agar bisa langsung dipakai di router
export const authController = new AuthController(authService);
