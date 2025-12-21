import type { Prisma, PrismaClient } from '../generated/prisma/index.js';
import { PaginationParams } from '../types/common/index.js';
import { BaseService, type CustomErrorMessages } from './baseService.js';
import { Error400 } from './customError.js';

export abstract class GenericBaseService<
  TDelegate extends {
    findMany: any;
    findUniqueOrThrow: any;
    create: any;
    update: any;
    delete: any;
  },
  TModel,
  TCreateInput,
  TUpdateInput,
  TFindManyArgs extends { [key: string]: any }, // Constraint ini sudah bagus agar fleksibel
  TFindUniqueArgs,
  TCreateArgs,
  TUpdateArgs,
  TDeleteArgs,
> extends BaseService {
  protected _model: TDelegate;
  private _idField: string;

  constructor(prisma: PrismaClient, model: TDelegate, idField: string) {
    super(prisma);
    this._model = model;
    this._idField = idField;
  }

  // --- KONTRAK PUBLIK ---

  public async create(data: TCreateInput): Promise<TModel> {
    const args = { data } as unknown as TCreateArgs; // Tambah unknown agar casting aman
    return this._create(args);
  }

  public async update(id: number, data: TUpdateInput): Promise<TModel> {
    const args = { data } as unknown as Omit<TUpdateArgs, 'where'>;
    return this._update(id, args);
  }

  // --- METHOD CRUD PUBLIK LAINNYA ---

  public async findAll(
    args?: TFindManyArgs & PaginationParams,
    customMessages?: CustomErrorMessages
  ): Promise<TModel[]> {
    // [FIX] Ganti TEntity[] menjadi TModel[] (karena TEntity tidak didefinisikan)

    return this._handleCrudOperation(async () => {
      // 1. Destructuring: Ambil page & limit, sisanya adalah args murni Prisma
      const { page = 1, limit = 10, ...prismaArgs } = args || {};

      // 2. Kalkulasi Pagination
      const take = Number(limit);
      const skip = (Number(page) - 1) * take;

      // 3. Panggil Prisma
      // Kita spread prismaArgs (select, include, where) dan inject take/skip manual
      return this._model.findMany({
        ...prismaArgs,
        take: take,
        skip: skip,
      });
    }, customMessages);
  }

  public async findById(
    id: number,
    args?: Omit<TFindUniqueArgs, 'where'>,
    customMessages?: CustomErrorMessages
  ): Promise<TModel> {
    // Casting 'as any' diperlukan karena Dynamic Key {[this._idField]: id}
    // sering dianggap tidak kompatibel dengan strict typing Prisma WhereInput
    const queryArgs = { ...args, where: { [this._idField]: id } } as any;

    return this._handleCrudOperation(
      () => this._model.findUniqueOrThrow(queryArgs),
      customMessages
    );
  }

  public async delete(
    id: number,
    args?: Omit<TDeleteArgs, 'where'>,
    customMessages?: CustomErrorMessages
  ): Promise<TModel> {
    const queryArgs = { ...args, where: { [this._idField]: id } } as any;

    return this._handleCrudOperation(
      () => this._model.delete(queryArgs),
      customMessages
    );
  }

  // --- HELPER INTERNAL ---

  protected async _create(
    args: TCreateArgs,
    customMessages?: CustomErrorMessages
  ): Promise<TModel> {
    return this._handleCrudOperation(
      () => this._model.create(args),
      customMessages
    );
  }

  protected async _update(
    id: number,
    args: Omit<TUpdateArgs, 'where'>,
    customMessages?: CustomErrorMessages
  ): Promise<TModel> {
    // Validasi sederhana: Pastikan ada data yang dikirim
    if (
      !args ||
      !(args as any).data ||
      Object.keys((args as any).data).length === 0
    ) {
      throw new Error400('Tidak ada data yang dikirim untuk diupdate.');
    }

    const queryArgs = { ...args, where: { [this._idField]: id } } as any;

    return this._handleCrudOperation(
      () => this._model.update(queryArgs),
      customMessages
    );
  }
}
