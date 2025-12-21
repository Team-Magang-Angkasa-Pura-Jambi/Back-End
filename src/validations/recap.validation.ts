// src/validations/recap.validation.ts

import { z } from 'zod';
import { isoDate, positiveInt } from '../utils/schmeHelper.js';

export const getRecapSchema = z.object({
  query: z.object({
    energyType: z.enum(['Electricity', 'Water', 'Fuel']),
    startDate: isoDate('Tanggal Mulai'),
    endDate: isoDate('Tanggal Selesai'),
    meterId: positiveInt('ID Meter').optional(),
    sortBy: z
      .enum(['date', 'wbp', 'lwbp', 'consumption', 'target', 'pax', 'cost'])
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const recalculateRecapSchema = z.object({
  body: z.object({
    startDate: isoDate('Tanggal Mulai'),
    endDate: isoDate('Tanggal Selesai'),
    meterId: positiveInt('ID Meter').optional(),
  }),
});
