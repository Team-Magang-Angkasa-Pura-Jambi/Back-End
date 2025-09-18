import prisma from '../configs/db.js';
import { Prisma } from '../generated/prisma/index.js';
import { Error409 } from '../utils/customError.js';
import type {
  CreateEnergyTypeInput,
  UpdateEnergyTypeInput,
} from '../validations/energy.validation.js';

/**
 * Service yang menangani semua logika bisnis terkait Jenis Energi.
 */
export class EnergyTypeService {
  /**
   * Menemukan semua jenis energi.
   */
  public async findAll() {
    return prisma.energyType.findMany({
      orderBy: {
        energy_type_id: 'asc',
      },
    });
  }

  public async findAllActive() {
    return prisma.energyType.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        energy_type_id: 'asc',
      },
    });
  }

  /**
   * Menemukan satu jenis energi berdasarkan ID-nya.
   */
  public async findById(energyTypeId: number) {
    return prisma.energyType.findUnique({
      where: {
        energy_type_id: energyTypeId,
      },
    });
  }

  /**
   * Membuat jenis energi baru.
   */
  public async create(data: CreateEnergyTypeInput) {
    const existingType = await prisma.energyType.findUnique({
      where: { type_name: data.type_name },
    });
    if (existingType) {
      throw new Error409(
        `Jenis energi dengan nama '${data.type_name}' sudah ada.`
      );
    }

    return prisma.energyType.create({
      data,
    });
  }

  /**
   * Memperbarui data jenis energi yang ada.
   */
  public async update(energyTypeId: number, data: UpdateEnergyTypeInput) {
    const { type_name, unit_of_measurement } = data;

    if (type_name) {
      const existingType = await prisma.energyType.findFirst({
        where: {
          type_name: type_name,
          NOT: {
            energy_type_id: energyTypeId,
          },
        },
      });

      if (existingType) {
        throw new Error409(
          `Jenis energi dengan nama '${type_name}' sudah digunakan.`
        );
      }
    }

    const updateData = {
      ...(type_name && { type_name }),
      ...(unit_of_measurement && { unit_of_measurement }),
    };

    if (Object.keys(updateData).length === 0) {
      return prisma.energyType.findUnique({
        where: {
          energy_type_id: energyTypeId,
        },
      });
    }

    return prisma.energyType.update({
      where: {
        energy_type_id: energyTypeId,
      },
      data: updateData,
    });
  }

  /**
   * Menghapus jenis energi.
   */
  public async delete(energyTypeId: number) {
    try {
      return await prisma.energyType.update({
        where: {
          energy_type_id: energyTypeId,
        },

        data: {
          is_active: false,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new Error409(
          'Tidak dapat menghapus jenis energi karena masih digunakan oleh data lain (misal: meteran).'
        );
      }

      throw error;
    }
  }

  public async permanentDelete(energyTypeId: number) {
    try {
      return await prisma.energyType.delete({
        where: {
          energy_type_id: energyTypeId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new Error409(
          'Tidak dapat menghapus jenis energi karena masih digunakan oleh data lain (misal: meteran).'
        );
      }

      throw error;
    }
  }
}


  export const energyTypeService = new EnergyTypeService();
