import { Error401, Error403 } from '../utils/customError.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { userService, UserService } from './user.service.js';
import type { LoginBody } from '../types/auth.type.js';

export class AuthService {
  constructor(private readonly userService: UserService) {}

  public async login(data: LoginBody) {
    const { username, password } = data;

    const user = await this.userService.findByUsername(username);

    if (!user) {
      throw new Error401('Nama pengguna atau kata sandi salah.');
    }

    if (!user.role) {
      throw new Error403('Akses ditolak. Pengguna tidak memiliki peran.');
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordMatch) {
      throw new Error401('Nama pengguna atau kata sandi salah.');
    }

    const jwtPayload = {
      id: user.user_id,
      username: user.username,
      role: user.role.role_name,
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET!, {
      expiresIn: '1d',
    });

    return {
      user: {
        id: user.user_id,
        username: user.username,
        role: user.role.role_name,
      },
      token,
    };
  }

  public async whoami(userId: number) {
    return this.userService.findById(userId);
  }
}

export const authService = new AuthService(userService);
