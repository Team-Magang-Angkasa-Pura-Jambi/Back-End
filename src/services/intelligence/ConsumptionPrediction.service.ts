import prisma from '../../configs/db.js';
import type { ConsumptionPrediction, Prisma } from '../../generated/prisma/index.js';
import type {
  CreateConsumptionPredictionBody,
  UpdateConsumptionPredictionSchemaBody,
} from '../../types/intelligence/ConsumptionPrediction.types.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';

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
    data: CreateConsumptionPredictionBody,
  ): Promise<ConsumptionPrediction> {
    const {
      meter_id,
      prediction_date,
      predicted_value,
      confidence_lower_bound,
      confidence_upper_bound,
      model_version,
    } = data;

    const normalizedDate = new Date(prediction_date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const prismaData: Prisma.ConsumptionPredictionCreateInput = {
      prediction_date: normalizedDate,

      predicted_value: predicted_value ?? 0,
      confidence_lower_bound: confidence_lower_bound ?? 0,
      confidence_upper_bound: confidence_upper_bound ?? 0,

      model_version: model_version ?? '-',

      meter: {
        connect: {
          meter_id: meter_id,
        },
      },
    };

    return this._handleCrudOperation(() => this._model.create({ data: prismaData }));
  }
}
