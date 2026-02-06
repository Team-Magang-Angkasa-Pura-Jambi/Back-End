import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type DeepMockProxy } from 'vitest-mock-extended';
import { type PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

vi.mock('../../configs/db.js', async () => {
  const actualLib = await import('vitest-mock-extended');
  return {
    __esModule: true,
    default: actualLib.mockDeep<PrismaClient>(),
  };
});

vi.mock('../../notifications/notification.service.js', () => ({
  notificationService: {
    create: vi.fn(),
  },
}));
vi.mock('bcrypt');

import { UserService } from '../user.service.js';
import { notificationService } from '../../notifications/notification.service.js';
import { RoleName, type User } from '../../../generated/prisma/index.js';
import prisma from '../../../configs/db.js';

describe('UserService Test Suite', () => {
  let userService: UserService;

  const prismaMock = vi.mocked(prisma, true) as unknown as DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    vi.resetAllMocks();

    prismaMock.user.findFirst = vi.fn();
    prismaMock.user.findMany = vi.fn();
    prismaMock.user.create = vi.fn();
    prismaMock.user.update = vi.fn();
    prismaMock.user.findUnique = vi.fn();
    prismaMock.user.findUniqueOrThrow = vi.fn();

    userService = new UserService();
  });

  const mockDate = new Date();
  const mockRole = {
    role_id: 2,
    role_name: 'Staff',
    description: 'Staff Role',
    created_at: mockDate,
    updated_at: mockDate,
  };

  const mockUser: User & { role: typeof mockRole } = {
    user_id: 1,
    username: 'test_user',
    password_hash: 'hashed_123',
    role_id: 2,
    is_active: true,
    created_at: mockDate,
    updated_at: mockDate,
    photo_profile_url: null,
    role: mockRole,
  };

  const createBody = {
    username: 'new_user',
    password: 'password123',
    role_id: 2,
    is_active: true,
  };

  describe('method: create()', () => {
    it('Harus sukses membuat user baru, hash password, dan kirim notifikasi ke admin', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_secret' as any);

      const createdUser = {
        ...mockUser,
        username: 'new_user',
        role: { role_name: 'Staff', role_id: 2 },
      };
      prismaMock.user.create.mockResolvedValue(createdUser as any);

      const adminList = [{ user_id: 99, username: 'admin', role: { role_name: RoleName.Admin } }];
      prismaMock.user.findMany.mockResolvedValue(adminList as any);

      const result = await userService.create(createBody);

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { username: createBody.username },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(createBody.password, 10);
      expect(prismaMock.user.create).toHaveBeenCalled();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(notificationService.create).toHaveBeenCalledTimes(1);

      expect(result).toEqual(createdUser);
    });

    it('Harus melempar Error409 jika username sudah dipakai oleh user AKTIF', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ ...mockUser, is_active: true });
      await expect(userService.create(createBody)).rejects.toThrow();
    });

    it('Harus RESTORE user jika username ada tapi TIDAK AKTIF', async () => {
      const inactiveUser = { ...mockUser, username: 'new_user', is_active: false };
      prismaMock.user.findFirst.mockResolvedValue(inactiveUser);
      vi.mocked(bcrypt.hash).mockResolvedValue('new_hashed_secret' as any);

      const restoredUser = { ...inactiveUser, is_active: true };
      prismaMock.user.update.mockResolvedValue(restoredUser);

      const result = await userService.create(createBody);

      expect(prismaMock.user.update).toHaveBeenCalled();
      expect(result.is_active).toBe(true);
    });
  });

  describe('method: findAll()', () => {
    it('Harus return array user dengan filter yang sesuai', async () => {
      prismaMock.user.findMany.mockResolvedValue([mockUser]);
      const query = { roleName: RoleName.Technician, isActive: true, search: 'test' };

      const result = await userService.findAll(query);

      expect(prismaMock.user.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('method: update()', () => {
    it('Harus update user dan hash password baru jika password dikirim', async () => {
      const updateBody = { password: 'newpassword', role_id: 3 };
      vi.mocked(bcrypt.hash).mockResolvedValue('new_hashed' as any);

      const updatedUser = { ...mockUser, role_id: 3 };
      prismaMock.user.update.mockResolvedValue(updatedUser);

      await userService.update(1, updateBody);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it('Tidak boleh hash password jika field password kosong', async () => {
      const updateBody = { role_id: 3 };
      prismaMock.user.update.mockResolvedValue(mockUser);

      await userService.update(1, updateBody);

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('method: delete()', () => {
    it('Harus melakukan Soft Delete (set is_active = false)', async () => {
      prismaMock.user.update.mockResolvedValue({ ...mockUser, is_active: false });

      await userService.delete(1);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { is_active: false } }),
      );
    });
  });

  describe('method: findByUsername()', () => {
    it('Harus return user jika ditemukan', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      const result = await userService.findByUsername('test_user');
      expect(result).toEqual(mockUser);
    });
  });

  describe('method: getActivityHistory()', () => {
    it('Harus menggabungkan data dari Reading, PriceScheme, dan Target lalu mengurutkannya', async () => {
      const mockComplexUser = {
        ...mockUser,
        reading_sessions: [
          {
            session_id: 101,
            created_at: new Date('2023-10-20T10:00:00Z'),
            meter: { meter_code: 'M-1', energy_type: { type_name: 'Electricity' } },
          },
        ],
        price_schemes_set: [
          {
            scheme_id: 201,
            effective_date: new Date('2023-10-25T10:00:00Z'),
            scheme_name: 'Tarif A',
            tariff_group: { group_name: 'Bisnis' },
          },
        ],
        efficiency_targets_set: [],
      };

      prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockComplexUser);

      const history = await userService.getActivityHistory(1);

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe(201);
      expect(history[1].id).toBe(101);
    });

    it('Harus melempar error jika user tidak ditemukan', async () => {
      prismaMock.user.findUniqueOrThrow.mockRejectedValue(new Error('User not found'));
      await expect(userService.getActivityHistory(999)).rejects.toThrow('User not found');
    });
  });
});
