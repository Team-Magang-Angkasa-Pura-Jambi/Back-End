import { Prisma } from '../../generated/prisma/index.js';
import { Error400, Error404 } from '../../utils/customError.js';

export type AppError = Prisma.PrismaClientKnownRequestError | Error;

export const handlePrismaError = (error: any, entityName = 'Data') => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new Error404(`${entityName} tidak ditemukan`);
    }

    if (error.code === 'P2002') {
      const targetColumns = error.meta?.target as string[] | undefined;
      const fieldName: string = targetColumns ? targetColumns.join(', ') : 'tertentu';

      throw new Error400(`${entityName} dengan kolom '${fieldName}' tersebut sudah ada (duplikat)`);
    }

    if (error.code === 'P2003') {
      const fieldName = error.meta?.field_name as string | undefined;
      const exactField: string = fieldName ?? 'terkait';

      throw new Error400(
        `${entityName} tidak bisa diproses karena referensi data pada field '${exactField}' tidak valid atau tidak ditemukan di database.`,
      );
    }
  }

  throw error;
};
