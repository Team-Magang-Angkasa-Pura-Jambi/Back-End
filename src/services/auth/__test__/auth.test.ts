import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service.js';
import { Error401, Error500 } from '../../../utils/customError.js';

vi.mock('bcrypt');
vi.mock('jsonwebtoken');

vi.mock('../../configs/db.js', () => ({
  default: {},
}));

const userServiceMock = {
  findByUsername: vi.fn(),
};

describe('AuthService Test Suite', () => {
  let authService: AuthService;
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetAllMocks();

    process.env = { ...OLD_ENV, JWT_SECRET: 'test-secret-key' };

    authService = new AuthService(userServiceMock as any);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  const mockUser = {
    user_id: 1,
    username: 'admin_test',
    password_hash: 'hashed_password_123',
    is_active: true,
    role: {
      role_name: 'Admin',
    },
  };

  const loginData = {
    username: 'admin_test',
    password: 'password123',
  };

  describe('method: login()', () => {
    it('Harus berhasil login, me-return user info dan token JWT jika kredensial valid', async () => {
      vi.mocked(userServiceMock.findByUsername).mockResolvedValue(mockUser as any);

      vi.mocked(bcrypt.compare).mockResolvedValue(true as any);

      const mockToken = 'ey.mock.token';
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

      const result = await authService.login(loginData);

      expect(userServiceMock.findByUsername).toHaveBeenCalledWith(loginData.username);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password_hash);
      expect(jwt.sign).toHaveBeenCalled();

      expect(result).toEqual({
        user: {
          id: 1,
          username: 'admin_test',
          role: 'Admin',
        },
        token: mockToken,
      });
    });

    it('Harus melempar Error jika JWT_SECRET tidak didefinisikan di env', async () => {
      delete process.env.JWT_SECRET;

      await expect(authService.login(loginData)).rejects.toThrow(
        'JWT_SECRET environment variable is not defined.',
      );
    });

    it('Harus melempar Error401 jika username tidak ditemukan', async () => {
      vi.mocked(userServiceMock.findByUsername).mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow(Error401);

      await expect(authService.login(loginData)).rejects.toThrow(
        'Nama pengguna atau kata sandi salah.',
      );
    });

    it('Harus melempar Error401 jika user ditemukan tapi TIDAK AKTIF', async () => {
      const inactiveUser = { ...mockUser, is_active: false };
      vi.mocked(userServiceMock.findByUsername).mockResolvedValue(inactiveUser as any);

      await expect(authService.login(loginData)).rejects.toThrow(Error401);
    });

    it('Harus melempar Error401 jika password salah', async () => {
      vi.mocked(userServiceMock.findByUsername).mockResolvedValue(mockUser as any);

      vi.mocked(bcrypt.compare).mockResolvedValue(false as any);

      await expect(authService.login(loginData)).rejects.toThrow(Error401);
    });

    it('Harus melempar Error500 jika data user corrupt (tidak punya Role)', async () => {
      const corruptUser = { ...mockUser, role: null };

      vi.mocked(userServiceMock.findByUsername).mockResolvedValue(corruptUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any);

      await expect(authService.login(loginData)).rejects.toThrow(Error500);

      await expect(authService.login(loginData)).rejects.toThrow(
        'Data pengguna tidak valid: peran tidak ditemukan.',
      );
    });
  });
});
