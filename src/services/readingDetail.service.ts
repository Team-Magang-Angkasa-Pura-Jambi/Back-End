import prisma from '../configs/db.js';
import type { Prisma, ReadingDetail } from '../generated/prisma/index.js';
import type { DefaultArgs } from '../generated/prisma/runtime/library.js';
import type {
  CreateReadingDetailBody,
  UpdateReadingDetailBody,
} from '../types/readingDetail.type.js';
import type { CustomErrorMessages } from '../utils/baseService.js';

import { GenericBaseService } from '../utils/GenericBaseService.js';

export class ReadingDetailService extends GenericBaseService<
  typeof prisma.readingDetail,
  ReadingDetail,
  CreateReadingDetailBody,
  UpdateReadingDetailBody,
  Prisma.ReadingDetailFindManyArgs,
  Prisma.ReadingDetailFindUniqueArgs,
  Prisma.ReadingDetailCreateArgs,
  Prisma.ReadingDetailUpdateArgs,
  Prisma.ReadingDetailDeleteArgs
> {
  constructor() {
    super(prisma, prisma.readingDetail, 'detail_id');
  }

  public override async findAll(
    args?: Prisma.ReadingDetailFindManyArgs
  ): Promise<ReadingDetail[]> {
    // Gunakan tipe baru di sini

    // Gabungkan argumen yang ada dengan klausa 'include'
    const findArgs = {
      ...args,
      include: {
        reading_type: true,
        session: true,
      },
      // orderBy: {
      //   session: {
      //     reading_date: 'desc',
      //   },
      // },
    };

    // Panggil metode 'findAll' dari parent dengan argumen yang sudah diperbarui
    return super.findAll(findArgs);
  }
}
