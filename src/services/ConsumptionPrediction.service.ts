import prisma from '../configs/db.js';
import type {
  ConsumptionPrediction,
  MeterCategory,
  Prisma,
} from '../generated/prisma/index.js';
import type { DefaultArgs } from '../generated/prisma/runtime/library.js';
import type {
  CreateConsumptionPredictionBody,
  UpdateConsumptionPredictionSchemaBody,
} from '../types/ConsumptionPrediction.types.js';
import type {
  CreateMeterCategoryBody,
  UpdateMeterCategoryBody,
} from '../types/metering/meterCategory.type.js';
import type { CustomErrorMessages } from '../utils/baseService.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';

export class ConsumptionPredictionService extends GenericBaseService<
  typeof prisma.consumptionPrediction,
  ConsumptionPrediction,
  CreateConsumptionPredictionBody,
  UpdateConsumptionPredictionSchemaBody,
  Prisma.ConsumptionPredictionFindManyArgs,
  Prisma.ConsumptionPredictionFindUniqueArgs,
  Prisma.ConsumptionPredictionCreateArgs,
  Prisma.ConsumptionPredictionUpdateArgs,
  Prisma.ConsumptionPredictionDeleteArgs
> {
  constructor() {
    super(prisma, prisma.consumptionPrediction, 'predictionId');
  }

  public override async create(
    data: CreateConsumptionPredictionBody
  ): Promise<ConsumptionPrediction> {
    const { meter_id, ...restOfData } = data;

    // Normalisasi tanggal untuk memastikan waktu diatur ke 00:00:00 UTC
    const normalizedDate = new Date(data.prediction_date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const prismaData: Prisma.ConsumptionPredictionCreateInput = {
      ...restOfData,
      prediction_date: normalizedDate,
      meter: {
        connect: {
          meter_id: meter_id,
        },
      },
    };

    return this._handleCrudOperation(() =>
      this._model.create({ data: prismaData })
    );
  }
}
