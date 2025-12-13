// src/services/auth.service.ts
import { Error401, Error500 } from '../utils/customError.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { BaseService } from '../utils/baseService.js';
import { userService, UserService } from './user.service.js';
import type { LoginBody } from '../types/auth.type.js';
import prisma from '../configs/db.js';

export interface IJwtPayload {
  id: number;
  username: string;
  role: string;
}

export class AuthService extends BaseService {
  constructor(private readonly userService: UserService) {
    super(prisma);
  }

  /**
   * Login pengguna (validasi username & password lalu buat token JWT).
   */
  public async login(data: LoginBody) {
    const { username, password } = data;

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not defined.');
    }

    const user = await this.userService.findByUsername(username);

    if (!user || !user.is_active) {
      throw new Error401('Nama pengguna atau kata sandi salah.');
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch) {
      throw new Error401('Nama pengguna atau kata sandi salah.');
    }

    if (!user.role) {
      throw new Error500('Data pengguna tidak valid: peran tidak ditemukan.');
    }

    const jwtPayload: IJwtPayload = {
      id: user.user_id,
      username: user.username,
      role: user.role.role_name,
    };

    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '1d' });

    return {
      user: {
        id: user.user_id,
        username: user.username,
        role: user.role.role_name,
      },
      token,
    };
  }
}

export const authService = new AuthService(userService);
