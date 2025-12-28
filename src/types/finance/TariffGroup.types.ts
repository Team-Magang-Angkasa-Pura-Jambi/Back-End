import { z } from 'zod';
import type {
  paramsTariffGroup,
  tariffGroupSchemas,
} from '../../validations/finance/TariffGroup.validation.js';

export type CreateTariffGroupBody = z.infer<typeof tariffGroupSchemas.body>;

export type UpdateTariffGroupBody = z.infer<
  typeof tariffGroupSchemas.bodyPartial
>;

export type TariffGroupParams = z.infer<typeof tariffGroupSchemas.params>;

export type GetTariffGroupQuery = z.infer<typeof paramsTariffGroup>['query'];
