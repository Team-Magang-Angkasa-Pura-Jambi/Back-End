// src/utils/BaseController.ts

import type { Request, Response } from 'express';
import { res200, res201 } from '../utils/response.js';
import type { CustomErrorMessages } from './baseService.js';

/**
 * [FIX] Interface service disederhanakan agar cocok dengan signature
 * method di service layer kita (menerima data input secara langsung).
 * Juga ditambahkan generic untuk ListQuery.
 */
interface IGenericService<TModel, TCreateInput, TUpdateInput, TListQuery> {
  // Method untuk get list sekarang menerima query
  findAll(args?: any, customMessages?: CustomErrorMessages): Promise<TModel[]>;

  findById(id: number): Promise<TModel>;
  // Method create dan update menerima data body secara langsung
  create(data: TCreateInput): Promise<TModel>;
  update(id: number, data: TUpdateInput): Promise<TModel>;
  delete(id: number): Promise<TModel>;
  softDelete?(id: number): Promise<TModel>; // Dibuat opsional
}

export abstract class BaseController<
  TModel,
  TCreateInput,
  TUpdateInput,
  TListQuery,
  TService extends IGenericService<
    TModel,
    TCreateInput,
    TUpdateInput,
    TListQuery
  >,
> {
  protected service: TService;
  private idParamName: string;

  constructor(service: TService, idParamName: 'userId' | string) {
    this.service = service;
    this.idParamName = idParamName;
  }

  /**
   * [FIX] Method getAll sekarang menangani query secara default.
   * Kelas anak bisa meng-override jika perlu memanggil method service yang berbeda.
   */
  public getAll = async (req: Request, res: Response) => {
    const queryData: TListQuery = res.locals.validatedData.query;
    console.log(queryData);

    const result = await this.service.findAll(queryData);

    res200({ res, message: 'Berhasil mengambil semua data.', data: result });
  };

  public getById = async (req: Request, res: Response) => {
    const id = res.locals.validatedData.params[this.idParamName];
    const result = await this.service.findById(id);
    res200({ res, message: 'Berhasil mengambil data.', data: result });
  };

  /**
   * [FIX] Method create sekarang memanggil service dengan lebih sederhana,
   * sesuai dengan kontrak interface yang baru.
   */
  public create = async (req: Request, res: Response) => {
    const body: TCreateInput = res.locals.validatedData.body;
    const result = await this.service.create(body);
    res201({ res, message: 'Berhasil membuat data baru.', data: result });
  };

  public update = async (req: Request, res: Response) => {
    const id = res.locals.validatedData.params[this.idParamName];
    const body: TUpdateInput = res.locals.validatedData.body;
    const result = await this.service.update(id, body);
    res200({ res, message: 'Berhasil memperbarui data.', data: result });
  };

  /**
   * [FIX] Method delete di base class akan melakukan hard delete.
   * Kelas anak bisa meng-override untuk melakukan soft delete.
   */
  public delete = async (req: Request, res: Response) => {
    const id = res.locals.validatedData.params[this.idParamName];
    await this.service.delete(id);
    res200({ res, message: 'Berhasil menghapus data secara permanen.' });
  };
}
