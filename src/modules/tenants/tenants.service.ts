import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { type PayloadTenants } from './tenants.type.js';

export const tenantsService = {
  store: async (payload: PayloadTenants) => {
    try {
      return await prisma.tenant.create({
        data: payload,
      });
    } catch (error) {
      return handlePrismaError(error, 'Tenant');
    }
  },

  show: async (
    id?: number,
    query?: { name?: string; category?: string; contact_person?: string },
  ) => {
    try {
      if (id) {
        return await prisma.tenant.findUnique({
          where: { tenant_id: Number(id) },
          include: {
            creator: { select: { full_name: true } },

            meters: { select: { meter_code: true, meter_id: true } },
          },
        });
      }

      const where: Prisma.TenantWhereInput = {};

      if (query?.name) {
        where.name = { contains: query.name, mode: 'insensitive' };
      }
      if (query?.category) {
        where.category = query.category;
      }
      if (query?.contact_person) {
        where.contact_person = { contains: query.contact_person, mode: 'insensitive' };
      }

      return await prisma.tenant.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      return handlePrismaError(error, 'Tenant');
    }
  },

  patch: async (id: number, payload: Partial<PayloadTenants>) => {
    try {
      return await prisma.tenant.update({
        where: { tenant_id: Number(id) },
        data: payload,
      });
    } catch (error) {
      return handlePrismaError(error, 'Tenant');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.tenant.delete({
        where: { tenant_id: Number(id) },
      });
    } catch (error) {
      return handlePrismaError(error, 'Tenant');
    }
  },

  showCategory: async () => {
    try {
      const categories = await prisma.tenant.groupBy({
        by: ['category'],
        orderBy: {
          category: 'asc',
        },
      });

      return categories.map((item) => item.category).filter((cat) => cat !== null);
    } catch (error) {
      return handlePrismaError(error, 'Tenant Category');
    }
  },
};
