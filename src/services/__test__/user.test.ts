import { describe, it, beforeEach, expect, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { type PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

import { userService } from '../auth/user.service.js';
import prisma from '../../configs/db.js';
import { notificationService } from '../notifications/notification.service.js';
import { Error409 } from '../../utils/customError.js';

vi.mock('../../configs/db.js', () => ({ default: mockDeep<PrismaClient>() }));
vi.mock('bcrypt');
vi.mock('../notification.service.js', () => ({
  notificationService: { create: vi.fn() },
}));

describe('UserService Test Suite', () => {
  const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

  const mockInput = {
    username: 'testuser',
    password: 'plainPassword123',
    role_id: 2,
    full_name: 'Test User',
    email: 'test@example.com',
  };

  const mockUserResult = {
    user_id: 1,
    ...mockInput,
    is_active: true,

    role: { role_name: 'Staff' },
  };

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed_secret_123' as never);
  });

  describe('Method: create()', () => {
    describe('Schema & Data Transformation', () => {
      it('Harus mengubah password mentah menjadi hash sebelum simpan ke DB', async () => {
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.user.findMany.mockResolvedValue([]);

        prismaMock.user.create.mockResolvedValue(mockUserResult as any);

        await userService.create(mockInput as any);

        expect(bcrypt.hash).toHaveBeenCalledWith('plainPassword123', 10);
        expect(prismaMock.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              password_hash: 'hashed_secret_123',
            }),
          }),
        );
      });

      it('Harus membuang field password mentah (Sanitasi)', async () => {
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.user.findMany.mockResolvedValue([]);

        prismaMock.user.create.mockResolvedValue(mockUserResult as any);

        await userService.create(mockInput as any);

        const callArgs = prismaMock.user.create.mock.calls[0][0];
        expect(callArgs.data.password).toBeUndefined();
      });
    });

    describe('Business Logic Flow', () => {
      it('Positive: Jika username belum ada, buat user baru', async () => {
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.user.findMany.mockResolvedValue([]);

        prismaMock.user.create.mockResolvedValue(mockUserResult as any);

        const result = await userService.create(mockInput as any);

        expect(result.user_id).toBe(1);
        expect(prismaMock.user.create).toHaveBeenCalled();
      });

      it('Positive (Restore): Jika username ada tapi mati (is_active: false), lakukan UPDATE', async () => {
        prismaMock.user.findFirst.mockResolvedValue({
          user_id: 99,
          is_active: false,
        } as any);

        prismaMock.user.update.mockResolvedValue({
          ...mockUserResult,
          user_id: 99,
        } as any);

        await userService.create(mockInput as any);

        expect(prismaMock.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { user_id: 99 },
            data: expect.objectContaining({ is_active: true }),
          }),
        );
        expect(prismaMock.user.create).not.toHaveBeenCalled();
      });

      it('Negative (Conflict): Jika username ada dan hidup, lempar Error 409', async () => {
        prismaMock.user.findFirst.mockResolvedValue({
          user_id: 88,
          is_active: true,
        } as any);

        await expect(userService.create(mockInput as any)).rejects.toThrow(Error409);
      });
    });

    describe('Side Effects', () => {
      it('Harus mengirim notifikasi ke admin setelah sukses create', async () => {
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.user.findMany.mockResolvedValue([{ user_id: 100 } as any]);

        prismaMock.user.create.mockResolvedValue(mockUserResult as any);

        await userService.create(mockInput as any);

        expect(notificationService.create).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Method: update()', () => {
    describe('Schema Transformation', () => {
      it('Harus melakukan hash ulang jika password diganti', async () => {
        const updateData = { password: 'newPassword456' };

        prismaMock.user.update.mockResolvedValue(mockUserResult as any);

        await userService.update(1, updateData as any);

        expect(bcrypt.hash).toHaveBeenCalledWith('newPassword456', 10);
        expect(prismaMock.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              password_hash: 'hashed_secret_123',
            }),
          }),
        );
      });

      it('TIDAK boleh hash password jika password tidak diganti', async () => {
        const updateData = { full_name: 'Ganti Nama Aja' };
        prismaMock.user.update.mockResolvedValue(mockUserResult as any);

        await userService.update(1, updateData as any);

        expect(bcrypt.hash).not.toHaveBeenCalled();
      });
    });
  });

  describe('Method: delete()', () => {
    it('Logic Check: Harus melakukan SOFT DELETE (is_active: false), bukan hapus data', async () => {
      prismaMock.user.update.mockResolvedValue({
        user_id: 1,
        is_active: false,
      } as any);

      await userService.delete(1);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { user_id: 1 },
        data: { is_active: false },
      });
      expect(prismaMock.user.delete).not.toHaveBeenCalled();
    });
  });
});
