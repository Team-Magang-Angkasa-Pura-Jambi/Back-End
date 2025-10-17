import prisma from '../configs/db.js';
import { Prisma, type Meter } from '../generated/prisma/index.js';
import {
  BaseService,
  GenericBaseService,
} from '../utils/GenericBaseService.js';
import { Error400 } from '../utils/customError.js';
import type { CreateMeterBody, UpdateMeterBody } from '../types/meter.types.js';

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

  /**
   * Membuat meter baru dengan validasi khusus untuk tipe 'Fuel'.
   */

  public override async findAll(
    query: MeterQuery = {}
  ): Promise<MeterWithEnergyType[]> {
    const { energyTypeId, typeName } = query;
    const where: Prisma.MeterWhereInput = {};

    // Bangun klausa 'where' secara dinamis
    if (energyTypeId) {
      where.energy_type_id = energyTypeId;
    }
    if (typeName) {
      where.energy_type = {
        type_name: {
          contains: typeName,
          mode: 'insensitive',
        },
      };
    }

    const findArgs: Prisma.MeterFindManyArgs = {
      where,
      // PERBAIKAN UTAMA: Selalu sertakan relasi energy_type
      include: {
        category: true,
        tariff_group: true,
        energy_type: true,
        _count: true,
      },
      orderBy: {
        meter_id: 'asc',
      },
    };

    return this._handleCrudOperation(() => this._model.findMany(findArgs));
  }
  public override async create(data: CreateMeterBody): Promise<Meter> {
    return this._handleCrudOperation(async () => {
      const energyType = await this._prisma.energyType.findUniqueOrThrow({
        where: { energy_type_id: data.energy_type_id },
      });

      // BARU: Validasi bahwa golongan tarif yang dipilih memiliki konfigurasi harga yang valid
      // untuk tipe energi yang bersangkutan.
      await this._validateTariffGroupConfiguration(
        data.tariff_group_id,
        energyType.type_name
      );

      const createData: Prisma.MeterCreateInput = {
        meter_code: data.meter_code,
        status: data.status,
        energy_type: { connect: { energy_type_id: data.energy_type_id } },
        category: { connect: { category_id: data.category_id } },
        tariff_group: { connect: { tariff_group_id: data.tariff_group_id } },
      };

      // Validasi khusus jika tipe energi adalah 'Fuel'
      if (energyType.type_name === 'Fuel') {
        if (
          data.tank_height_cm == null ||
          data.tank_volume_liters == null ||
          data.tank_height_cm <= 0 ||
          data.tank_volume_liters <= 0
        ) {
          throw new Error400(
            "Untuk meter tipe 'Fuel', properti 'tank_height_cm' dan 'tank_volume_liters' wajib diisi dan harus lebih besar dari 0."
          );
        }
        createData.tank_height_cm = data.tank_height_cm;
        createData.tank_volume_liters = data.tank_volume_liters;
        createData.rollover_limit = null; // Pastikan null jika tipe Fuel
      } else {
        // Pastikan properti tangki null untuk tipe lain
        createData.tank_height_cm = null;
        createData.tank_volume_liters = null;
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
      // Ambil data meter saat ini untuk mengetahui tipe energinya
      const currentMeter = await this._model.findUniqueOrThrow({
        where: { [this._idField]: id },
        include: { energy_type: true },
      });

      // Tentukan tipe energi final (jika diubah atau tetap sama)
      const finalEnergyTypeId =
        data.energy_type_id ?? currentMeter.energy_type_id;
      const finalEnergyType =
        finalEnergyTypeId === currentMeter.energy_type_id
          ? currentMeter.energy_type
          : await this._prisma.energyType.findUniqueOrThrow({
              where: { energy_type_id: finalEnergyTypeId },
            });

      // BARU: Validasi konfigurasi tarif jika grup tarif atau tipe energi diubah.
      if (data.tariff_group_id || data.energy_type_id) {
        await this._validateTariffGroupConfiguration(
          data.tariff_group_id ?? currentMeter.tariff_group_id,
          finalEnergyType.type_name
        );
      }

      const updateData: Prisma.MeterUpdateInput = { ...data };

      // Validasi khusus jika tipe energi final adalah 'Fuel'
      if (finalEnergyType.type_name === 'Fuel') {
        // Jika properti tangki tidak disediakan dalam update, gunakan nilai yang ada
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
        // Jika tipe diubah menjadi BUKAN 'Fuel', pastikan properti tangki di-reset menjadi null
        updateData.tank_height_cm = null;
        updateData.tank_volume_liters = null;
      }

      return this._model.update({
        where: { [this._idField]: id },
        data: updateData,
        include: {
          energy_type: true,
          category: true,
          tariff_group: true,
        },
      });
    });
  }

  /**
   * BARU: Memvalidasi bahwa sebuah Golongan Tarif (TariffGroup) memiliki setidaknya
   * satu skema harga yang valid untuk tipe energi tertentu.
   * @param tariffGroupId - ID dari TariffGroup yang akan divalidasi.
   * @param energyTypeName - Nama dari tipe energi ('Electricity', 'Water', 'Fuel').
   */
  private async _validateTariffGroupConfiguration(
    tariffGroupId: number,
    energyTypeName: string
  ): Promise<void> {
    const tariffGroup = await this._prisma.tariffGroup.findUnique({
      where: { tariff_group_id: tariffGroupId },
      include: {
        price_schemes: {
          include: { rates: { include: { reading_type: true } } },
        },
      },
    });

    if (!tariffGroup) {
      throw new Error400(
        `Golongan tarif dengan ID ${tariffGroupId} tidak ditemukan.`
      );
    }

    if (tariffGroup.price_schemes.length === 0) {
      throw new Error400(
        `Golongan tarif '${tariffGroup.group_code}' tidak memiliki skema harga yang terkonfigurasi.`
      );
    }

    // Validasi khusus untuk Listrik: harus ada tarif WBP & LWBP di setidaknya satu skema.
    if (energyTypeName === 'Electricity') {
      const hasValidElectricityScheme = tariffGroup.price_schemes.some(
        (scheme) => {
          const hasWbp = scheme.rates.some(
            (rate) => rate.reading_type.type_name === 'WBP'
          );
          const hasLwbp = scheme.rates.some(
            (rate) => rate.reading_type.type_name === 'LWBP'
          );
          return hasWbp && hasLwbp;
        }
      );

      if (!hasValidElectricityScheme) {
        throw new Error400(
          `Golongan tarif '${tariffGroup.group_code}' tidak memiliki skema harga yang valid untuk Listrik. Pastikan setidaknya satu skema memiliki tarif untuk WBP dan LWBP.`
        );
      }
    }
  }
}

export const meterService = new MeterService();
