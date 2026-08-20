import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import {
  type CreateFormulaPayload,
  type UpdateFormulaPayload,
} from './formula_definitions.type.js';

export const formulaService = {
  show: async (id?: string, query?: { template_id?: string }) => {
    try {
      if (id) {
        return await prisma.formulaDefinition.findUnique({
          where: { def_id: id },
          include: { template: { select: { name: true } } },
        });
      }

      return await prisma.formulaDefinition.findMany({
        where: query?.template_id ? { template_id: query.template_id } : {},
        orderBy: { is_main: 'desc' },
      });
    } catch (error) {
      return handlePrismaError(error, 'Formula Definition');
    }
  },
  store: async (payload: CreateFormulaPayload) => {
    try {
      if (payload.formula.is_main) {
        await prisma.formulaDefinition.updateMany({
          where: { template_id: payload.formula.template_id, is_main: true },
          data: { is_main: false },
        });
      }

      return await prisma.formulaDefinition.create({
        data: payload.formula,
        include: {
          template: { select: { name: true } },
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'Formula Definition');
    }
  },

  patch: async (id: string, payload: UpdateFormulaPayload) => {
    try {
      if (payload.formula.is_main === true) {
        const currentFormula = await prisma.formulaDefinition.findUnique({
          where: { def_id: id },
          select: { template_id: true },
        });

        if (currentFormula) {
          await prisma.formulaDefinition.updateMany({
            where: { template_id: currentFormula.template_id, is_main: true },
            data: { is_main: false },
          });
        }
      }

      return await prisma.formulaDefinition.update({
        where: { def_id: id },
        data: payload.formula,
      });
    } catch (error) {
      return handlePrismaError(error, 'Formula Definition');
    }
  },

  remove: async (id: string) => {
    try {
      return await prisma.formulaDefinition.delete({
        where: { def_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Formula Definition');
    }
  },

  getByTemplate: async (templateId: string) => {
    try {
      return await prisma.formulaDefinition.findMany({
        where: { template_id: templateId },
        orderBy: { is_main: 'desc' },
      });
    } catch (error) {
      return handlePrismaError(error, 'Formula Definition');
    }
  },
};
