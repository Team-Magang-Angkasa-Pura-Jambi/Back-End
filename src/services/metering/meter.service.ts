import prisma from '../../configs/db.js';
import {
  $Enums,
  Prisma,
  RoleName,
  User,
  type Meter,
} from '../../generated/prisma/index.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { Error400 } from '../../utils/customError.js';
import type {
  CreateMeterBody,
  UpdateMeterBody,
} from '../../types/metering/meter.types-temp.js';
import { CustomErrorMessages } from '../../utils/baseService.js';
import { DefaultArgs } from '../../generated/prisma/runtime/library.js';

type TariffGroupForValidation = Prisma.TariffGroupGetPayload<{
  include: {
    price_schemes: {
      include: {
        rates: {
          include: { reading_type: true };
        };
      };
    };
  };
}>;

export class MeterService extends GenericBaseService<
  typeof prisma.meter,
  Meter,
  CreateMeterBody,
  UpdateMeterBody,
  Prisma.MeterFindManyArgs,
  Prisma.MeterFindUniqueArgs,
  Prisma.MeterCreateArgs,
  Prisma.MeterUpdateArgs,
  Prisma.MeterDeleteArgs
> {
  constructor() {
    super(prisma, prisma.meter, 'meter_id');
  }

  public async findAllwithRole(
    userId: number,
    args?: Prisma.MeterFindManyArgs & {
      energyTypeId?: number;
      typeName?: string;
    },
    customMessages?: CustomErrorMessages
  ) {
    const { energyTypeId, typeName, ...restArgs } = args || {};

    const user = await prisma.user.findFirstOrThrow({
      where: { user_id: userId },
      select: { role: { select: { role_name: true } } },
    });

    const roleName = user.role.role_name;

    const where: Prisma.MeterWhereInput = {
      ...restArgs.where,
    };
    if (roleName !== 'SuperAdmin') {
      where.status = { not: 'Deleted' };
    }
    if (energyTypeId) {
      where.energy_type_id = energyTypeId;
    }

    if (typeName) {
      where.energy_type = {
        is: {
          type_name: {
            contains: typeName,
            mode: 'insensitive',
          },
        },
      };
    }

    const findArgs: Prisma.MeterFindManyArgs = {
      ...restArgs,
      where,

      include: {
        ...(restArgs.include as any),

        category: true,
        tariff_group: true,
        energy_type: true,
      },

      orderBy: restArgs.orderBy || { meter_id: 'asc' },
    };

    return super.findAll(findArgs as any, customMessages);
  }

  public override async create(data: CreateMeterBody): Promise<Meter> {
    return this._handleCrudOperation(async () => {
      const energyType = await prisma.energyType.findUniqueOrThrow({
        where: { energy_type_id: data.energy_type_id },
      });

      const tariffGroup = await prisma.tariffGroup.findUnique({
        where: { tariff_group_id: data.tariff_group_id },
        include: {
          price_schemes: {
            include: {
              rates: {
                include: { reading_type: true },
              },
            },
          },
        },
      });

      if (!tariffGroup) {
        throw new Error400(
          `Golongan tarif dengan ID ${data.tariff_group_id} tidak ditemukan.`
        );
      }

      this._validateTariffGroupConfiguration(tariffGroup, energyType.type_name);

      const createData: Prisma.MeterCreateInput = {
        meter_code: data.meter_code,
        status: data.status,

        energy_type: { connect: { energy_type_id: data.energy_type_id } },
        category: { connect: { category_id: data.category_id } },
        tariff_group: { connect: { tariff_group_id: data.tariff_group_id } },

        tank_height_cm: null,
        tank_volume_liters: null,
        rollover_limit: data.rollover_limit ?? null,
      };

      if (energyType.type_name === 'Fuel') {
        if (
          !data.tank_height_cm ||
          !data.tank_volume_liters ||
          data.tank_height_cm <= 0 ||
          data.tank_volume_liters <= 0
        ) {
          throw new Error400(
            "Untuk meter tipe 'Fuel', properti 'tank_height_cm' dan 'tank_volume_liters' wajib diisi dan harus lebih besar dari 0."
          );
        }

        createData.tank_height_cm = data.tank_height_cm;
        createData.tank_volume_liters = data.tank_volume_liters;

        createData.rollover_limit = null;
      }

      return this._model.create({
        data: createData,
        include: {
          energy_type: true,
          category: true,
          tariff_group: true,
        },
      });
    });
  }

  /**
   * Memperbarui meter dengan validasi khusus untuk tipe 'Fuel'.
   */
  public override async update(
    id: number,
    data: UpdateMeterBody
  ): Promise<Meter> {
    return this._handleCrudOperation(async () => {
      const currentMeter = await this._model.findUniqueOrThrow({
        where: { meter_id: id },
        include: { energy_type: true },
      });

      const finalEnergyTypeId =
        data.energy_type_id ?? currentMeter.energy_type_id;
      const finalEnergyType =
        finalEnergyTypeId === currentMeter.energy_type_id
          ? currentMeter.energy_type
          : await prisma.energyType.findUniqueOrThrow({
              where: { energy_type_id: finalEnergyTypeId },
            });

      if (data.tariff_group_id || data.energy_type_id) {
        const targetTariffGroupId =
          data.tariff_group_id ?? currentMeter.tariff_group_id;

        const fullTariffGroup = await prisma.tariffGroup.findUnique({
          where: { tariff_group_id: targetTariffGroupId },
          include: {
            price_schemes: {
              include: { rates: { include: { reading_type: true } } },
            },
          },
        });

        if (!fullTariffGroup) {
          throw new Error400(
            `Golongan tarif dengan ID ${targetTariffGroupId} tidak ditemukan.`
          );
        }

        this._validateTariffGroupConfiguration(
          fullTariffGroup,
          finalEnergyType.type_name
        );
      }

      const updateData: Prisma.MeterUpdateInput = { ...data };

      if (finalEnergyType.type_name === 'Fuel') {
        const tankHeight =
          data.tank_height_cm ?? currentMeter.tank_height_cm?.toNumber();
        const tankVolume =
          data.tank_volume_liters ??
          currentMeter.tank_volume_liters?.toNumber();

        if (
          tankHeight == null ||
          tankVolume == null ||
          tankHeight <= 0 ||
          tankVolume <= 0
        ) {
          throw new Error400(
            "Untuk meter tipe 'Fuel', properti 'tank_height_cm' dan 'tank_volume_liters' wajib diisi dan harus lebih besar dari 0."
          );
        }
        updateData.tank_height_cm = tankHeight;
        updateData.tank_volume_liters = tankVolume;
      } else {
        updateData.tank_height_cm = null;
        updateData.tank_volume_liters = null;
      }

      return this._model.update({
        where: { meter_id: id },
        data: updateData,
        include: {
          energy_type: true,
          category: true,
          tariff_group: true,
        },
      });
    });
  }

  public override async delete(
    id: number,
    args?: Omit<Prisma.MeterDeleteArgs<DefaultArgs>, 'where'>
  ): Promise<Meter> {
    const availableChild = await prisma.readingSession.findFirst({
      where: { meter_id: id },
    });

    if (!availableChild) {
      return this._handleCrudOperation(() =>
        this._model.delete({ where: { meter_id: id } })
      );
    }

    return this._handleCrudOperation(() =>
      this._model.update({
        where: { meter_id: id },
        data: { status: 'Deleted' },
        ...args,
      })
    );
  }

  /**
   * BARU: Memvalidasi bahwa sebuah Golongan Tarif (TariffGroup) memiliki setidaknya
   * satu skema harga yang valid untuk tipe energi tertentu.
   * @param tariffGroupId - ID dari TariffGroup yang akan divalidasi.
   * @param energyTypeName - Nama dari tipe energi ('Electricity', 'Water', 'Fuel').
   */

  private _validateTariffGroupConfiguration(
    tariffGroup: TariffGroupForValidation,
    energyTypeName: string
  ): void {
    if (tariffGroup.price_schemes.length === 0) {
      throw new Error400(
        `Golongan tarif '${tariffGroup.group_code}' tidak memiliki skema harga yang terkonfigurasi.`
      );
    }

    if (energyTypeName === 'Electricity') {
      const hasValidElectricityScheme = tariffGroup.price_schemes.some(
        (scheme) => {
          const rateTypes = new Set(
            scheme.rates.map((r) => r.reading_type.type_name)
          );
          return rateTypes.has('WBP') && rateTypes.has('LWBP');
        }
      );

      if (!hasValidElectricityScheme) {
        throw new Error400(
          `Golongan tarif '${tariffGroup.group_code}' (Listrik) wajib memiliki tarif untuk WBP dan LWBP.`
        );
      }
    }
  }
}

export const meterService = new MeterService();
