import { Error400, Error404 } from '../../utils/customError.js';

export const handlePrismaError = (error: any, entityName = 'Data') => {
  if (error.code === 'P2025') {
    throw new Error404(`${entityName} tidak ditemukan`);
  }

  if (error.code === 'P2002') {
    throw new Error400(`${entityName} sudah ada (duplikat)`);
  }

  if (error.code === 'P2003') {
    throw new Error400(`${entityName} tidak bisa diproses karena relasi data bermasalah`);
  }

  throw error;
};
