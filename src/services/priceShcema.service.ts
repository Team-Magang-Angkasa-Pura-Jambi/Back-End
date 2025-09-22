// src/services/priceScheme.service.ts

import prisma from '../configs/db.js';
import type { PriceScheme, Prisma } from '../generated/prisma/index.js';
import type { CreatePriceSchemeInput } from '../types/priceSchema.types.js';
import type { CustomErrorMessages } from '../utils/baseService.js';
import { Error404 } from '../utils/customError.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';

// Tipe-tipe spesifik tetap didefinisikan untuk keamanan
type PriceSchemeModel = PriceScheme;
type PriceSchemeCreateInput = CreatePriceSchemeInput;
type PriceSchemeUpdateInput = Prisma.PriceSchemeUpdateInput &
  Record<string, any>;

type PrismaCreateArgs = {
  data: PriceSchemeCreateInput;
  include?: any;
  select?: any;
};

// Perhatikan: deklarasi generic sekarang lebih pendek!
export class PriceSchemeService extends GenericBaseService<
  PriceSchemeModel,
  PriceSchemeCreateInput,
  PriceSchemeUpdateInput
> {
  constructor() {
    // Logika di sini tidak berubah sama sekali
    super(
      prisma,
      prisma.priceScheme, // Cukup kirim delegate-nya
      'scheme_id'
    );
  }

  public async findAllActiveWithRates(): Promise<PriceSchemeModel[]> {
    return this._handleCrudOperation(() =>
      this._model.findMany({
        where: { is_active: true },
        include: {
          rates: true, // Menyertakan relasi 'rates'
        },
      })
    );
  }

  public async create(
    args: PrismaCreateArgs,
    customMessages?: CustomErrorMessages
  ): Promise<PriceSchemeModel> {
    const { energy_type_id } = args.data;

    
    const energyTypeExists = await this._prisma.energyType.findUnique({
      where: { energy_type_id },
    });

    if (!energyTypeExists) {
      throw new Error404(
        `Tipe energi dengan ID ${energy_type_id} tidak ditemukan.`
      );
    }

    // 3. Jika ditemukan, lanjutkan proses create dengan memanggil metode 'create' dari parent.
    // Ini memastikan logika CRUD dasar dan error handling umum tetap berjalan.
    return super.create(args, customMessages);
  }
}
