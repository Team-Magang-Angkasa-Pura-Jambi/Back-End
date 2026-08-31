import { Error404 } from '../../utils/customError.js';
import prisma from '../../configs/db.js';
import { Prisma } from '../../generated/prisma/index.js';

export class PageGuidesService {
  async getAll() {
    return await prisma.pageGuide.findMany({
      orderBy: { route: 'asc' },
    });
  }

  async getByRoute(route: string) {
    const guide = await prisma.pageGuide.findUnique({
      where: { route },
    });

    if (!guide?.is_active) {
      throw new Error404(`Panduan untuk rute ${route} tidak ditemukan atau tidak aktif`);
    }

    return guide;
  }

  async update(guide_id: number, data: Prisma.PageGuideUncheckedUpdateInput, updated_by: number) {
    const existing = await prisma.pageGuide.findUnique({
      where: { guide_id },
    });

    if (!existing) {
      throw new Error404('Panduan halaman tidak ditemukan');
    }

    return prisma.pageGuide.update({
      where: { guide_id },
      data: {
        ...data,
        updated_by,
      },
    });
  }

  async create(data: Prisma.PageGuideUncheckedCreateInput, created_by: number) {
    return prisma.pageGuide.create({
      data: {
        ...data,
        updated_by: created_by,
      },
    });
  }

  async delete(guide_id: number) {
    const existing = await prisma.pageGuide.findUnique({
      where: { guide_id },
    });

    if (!existing) {
      throw new Error404('Panduan halaman tidak ditemukan');
    }

    return prisma.pageGuide.delete({
      where: { guide_id },
    });
  }
}

export const pageGuidesService = new PageGuidesService();
