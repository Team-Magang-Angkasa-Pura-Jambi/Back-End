import type { Prisma, PrismaClient } from '../generated/prisma/index.js';
import { BaseService, type CustomErrorMessages } from './baseService.js';
import { Error400 } from './customError.js';

/**
 * Kelas dasar abstrak untuk menyediakan fungsionalitas CRUD generik.
 *
 * @template TDelegate - Tipe delegasi model Prisma (e.g., prisma.user).
 * @template TModel - Tipe model hasil (e.g., User).
 * @template TCreateInput - Tipe input sederhana untuk operasi create (dari Zod).
 * @template TUpdateInput - Tipe input sederhana untuk operasi update (dari Zod).
 * @template TFindManyArgs - Tipe argumen Prisma untuk findMany.
 * @template TFindUniqueArgs - Tipe argumen Prisma untuk findUnique.
 * @template TCreateArgs - Tipe argumen Prisma untuk create.
 * @template TUpdateArgs - Tipe argumen Prisma untuk update.
 * @template TDeleteArgs - Tipe argumen Prisma untuk delete.
 */
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
  TFindManyArgs,
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

  // --- KONTRAK PUBLIK (WAJIB DIIMPLEMENTASIKAN OLEH KELAS ANAK) ---

  /**
   * Kontrak untuk membuat entitas baru. Menerima data input sederhana.
   */
  public async create(data: TCreateInput): Promise<TModel> {
    // Memanggil helper _create dengan membungkus data input
    // ke dalam objek { data: ... } yang diharapkan Prisma.
    const args = { data } as TCreateArgs;
    return this._create(args);
  }

  /**
   * Kontrak untuk memperbarui entitas. Menerima data input sederhana.
   */
  public async update(id: number, data: TUpdateInput): Promise<TModel> {
    // Memanggil helper _update dengan membungkus data input
    // ke dalam objek { data: ... } yang diharapkan Prisma.
    const args = { data } as unknown as Omit<TUpdateArgs, 'where'>;
    return this._update(id, args);
  }

  // --- METHOD CRUD PUBLIK LAINNYA ---

  public async findAll(
    args?: TFindManyArgs,
    customMessages?: CustomErrorMessages
  ): Promise<TModel[]> {
    return this._handleCrudOperation(
      () => this._model.findMany(args),
      customMessages
    );
  }

  public async findById(
    id: number,
    args?: Omit<TFindUniqueArgs, 'where'>,
    customMessages?: CustomErrorMessages
  ): Promise<TModel> {
    const queryArgs = { ...args, where: { [this._idField]: id } };
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
    const queryArgs = { ...args, where: { [this._idField]: id } };
    return this._handleCrudOperation(
      () => this._model.delete(queryArgs),
      customMessages
    );
  }

  // --- HELPER INTERNAL (HANYA BISA DIAKSES OLEH KELAS ANAK) ---

  /**
   * Helper internal untuk operasi 'create' yang menggunakan tipe argumen dari Prisma.
   */
  protected async _create(
    args: TCreateArgs,
    customMessages?: CustomErrorMessages
  ): Promise<TModel> {
    return this._handleCrudOperation(
      () => this._model.create(args),
      customMessages
    );
  }

  /**
   * Helper internal untuk operasi 'update' yang menggunakan tipe argumen dari Prisma.
   */
  protected async _update(
    id: number,
    args: Omit<TUpdateArgs, 'where'>,
    customMessages?: CustomErrorMessages
  ): Promise<TModel> {
    if (
      !args ||
      typeof (args as any).data !== 'object' ||
      Object.keys((args as any).data).length === 0
    ) {
      throw new Error400('Tidak ada data yang dikirim untuk diupdate.');
    }
    const queryArgs = { ...args, where: { [this._idField]: id } };
    return this._handleCrudOperation(
      () => this._model.update(queryArgs),
      customMessages
    );
  }
}
