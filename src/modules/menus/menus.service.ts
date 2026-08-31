import { Error404 } from '../../utils/customError.js';
import prisma from '../../configs/db.js';
import { Prisma } from '../../generated/prisma/index.js';

export class MenusService {
  async getAll() {
    return await prisma.menu.findMany({
      orderBy: [
        { parent_id: 'asc' },
        { sort_order: 'asc' }
      ],
      include: {
        children: {
          orderBy: { sort_order: 'asc' }
        }
      }
    });
  }

  async getById(menu_id: number) {
    const menu = await prisma.menu.findUnique({
      where: { menu_id },
    });

    if (!menu) {
      throw new Error404(`Menu tidak ditemukan`);
    }

    return menu;
  }

  async create(data: Prisma.MenuUncheckedCreateInput) {
    return prisma.menu.create({
      data,
    });
  }

  async update(menu_id: number, data: Prisma.MenuUncheckedUpdateInput) {
    const existing = await prisma.menu.findUnique({
      where: { menu_id },
    });

    if (!existing) {
      throw new Error404('Menu tidak ditemukan');
    }

    return prisma.menu.update({
      where: { menu_id },
      data,
    });
  }

  async delete(menu_id: number) {
    const existing = await prisma.menu.findUnique({
      where: { menu_id },
    });

    if (!existing) {
      throw new Error404('Menu tidak ditemukan');
    }

    return prisma.menu.delete({
      where: { menu_id },
    });
  }
}

export const menusService = new MenusService();
