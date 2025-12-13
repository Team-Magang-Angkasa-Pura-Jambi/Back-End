import { describe, it, beforeEach, expect, vi, afterEach } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// 1. IMPORT SERVICE YANG MAU DITES
import { authService } from '../auth.service.js';

// 2. IMPORT DEPENDENCY UNTUK DI-MOCK
import { userService } from '../user.service.js';
import { Error401, Error500 } from '../../utils/customError.js';

// 3. MOCK MODULES
// Kita bajak bcrypt dan jwt
vi.mock('bcrypt');
vi.mock('jsonwebtoken');

// Kita bajak userService.
// Kita tidak mau authService memanggil userService yang asli (yang nembak DB).
vi.mock('../user.service.js', () => ({
  userService: {
    findByUsername: vi.fn(), // Kita pasang mata-mata di fungsi ini
  },
}));

// Mock Prisma (Hanya formalitas karena BaseService butuh ini)
vi.mock('../../configs/db.js', () => ({ default: {} }));

describe('AuthService Test Suite', () => {
  // Setup Environment Variable JWT_SECRET sebelum test jalan
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'rahasia-negara' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV; // Kembalikan env seperti semula
  });

  // Data Dummy User dari Database (Pura-pura)
  const mockUserDb = {
    user_id: 1,
    username: 'admin_sentinel',
    password_hash: '$2b$10$hashedpasswordExample...', // Hash pura-pura
    is_active: true,
    role: { role_name: 'Admin' },
  };

  // Data Input Login dari Controller
  const loginInput = {
    username: 'admin_sentinel',
    password: 'password123', // Password mentah
  };

  // ==========================================
  // 🟢 METHOD: login()
  // ==========================================
  describe('Method: login()', () => {
    // 1. Schema & Environment Check
    describe('System Check', () => {
      it('Harus melempar Error jika JWT_SECRET belum disetting di .env', async () => {
        // Hapus JWT_SECRET sementara
        process.env.JWT_SECRET = '';

        await expect(authService.login(loginInput)).rejects.toThrow(
          'JWT_SECRET environment variable is not defined'
        );
      });
    });

    // 2. Business Logic (Happy Path)
    describe('Positive Flow (Berhasil Login)', () => {
      it('Harus mengembalikan Token & Data User jika username & password benar', async () => {
        // ARRANGE
        // 1. Mock userService menemukan user
        vi.mocked(userService.findByUsername).mockResolvedValue(
          mockUserDb as any
        );

        // 2. Mock bcrypt bilang password COCOK (true)
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never); // as never untuk bypass type check

        // 3. Mock jwt membuat token
        vi.mocked(jwt.sign).mockReturnValue('token_palsu_valid' as never);

        // ACT
        const result = await authService.login(loginInput);

        // ASSERT
        // Cek userService dipanggil
        expect(userService.findByUsername).toHaveBeenCalledWith(
          'admin_sentinel'
        );

        // Cek bcrypt membandingkan password mentah vs hash
        expect(bcrypt.compare).toHaveBeenCalledWith(
          'password123',
          mockUserDb.password_hash
        );

        // Cek jwt membuat token dengan payload yang benar
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 1,
            username: 'admin_sentinel',
            role: 'Admin',
          }),
          'rahasia-negara', // Secret key
          expect.any(Object)
        );

        // Cek Hasil Akhir
        expect(result).toEqual({
          user: {
            id: 1,
            username: 'admin_sentinel',
            role: 'Admin',
          },
          token: 'token_palsu_valid',
        });
      });
    });

    // 3. Business Logic (Negative / Sad Path)
    describe('Negative Flow (Gagal Login)', () => {
      it('Gagal: Username tidak ditemukan -> Error 401', async () => {
        // Mock user tidak ketemu (null)
        vi.mocked(userService.findByUsername).mockResolvedValue(null);

        await expect(authService.login(loginInput)).rejects.toThrow(Error401);

        // Keamanan: Pastikan bcrypt TIDAK dipanggil (hemat resource & aman)
        expect(bcrypt.compare).not.toHaveBeenCalled();
      });

      it('Gagal: User ditemukan tapi NON-AKTIF -> Error 401', async () => {
        // Mock user ketemu tapi is_active: false
        vi.mocked(userService.findByUsername).mockResolvedValue({
          ...mockUserDb,
          is_active: false,
        } as any);

        await expect(authService.login(loginInput)).rejects.toThrow(Error401);
      });

      it('Gagal: Password SALAH -> Error 401', async () => {
        // Mock user ketemu
        vi.mocked(userService.findByUsername).mockResolvedValue(
          mockUserDb as any
        );
        // Mock bcrypt bilang SALAH (false)
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(authService.login(loginInput)).rejects.toThrow(Error401);
      });

      it('Integrity Error: User tidak punya Role -> Error 500', async () => {
        // Kasus aneh: User ada di DB, tapi relasi role-nya hilang/null
        vi.mocked(userService.findByUsername).mockResolvedValue({
          ...mockUserDb,
          role: null, // Role hilang
        } as any);

        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        await expect(authService.login(loginInput)).rejects.toThrow(Error500); // Harus throw Internal Server Error
      });
    });
  });
});
