// Generated for Sentinel Project

import prisma from '../../configs/db.js';
import bcrypt from 'bcrypt';
import { Error401, Error404 } from '../../utils/customError.js';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { type LoginPayload } from './auth.schema.js';

export const authService = {
  login: async (credential: LoginPayload) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error404('JWT_SECRET is not defined');
    }

    const user = await prisma.user.findUnique({
      where: { username: credential.username },
      select: { user_id: true, username: true, password_hash: true, full_name: true, role: true },
    });

    if (!user) {
      throw new Error401('Password atau username salah');
    }

    const isPassword = await bcrypt.compare(credential.password, user?.password_hash ?? '');
    if (!isPassword) {
      throw new Error401('Password atau username salah');
    }
    const jwtPayload: JwtPayload = {
      id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role.role_name,
    };

    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '1h' });
    return {
      user: jwtPayload,
      token,
    };
  },
};
