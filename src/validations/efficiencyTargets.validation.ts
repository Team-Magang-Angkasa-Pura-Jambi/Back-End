// import { z } from 'zod';
// import {
//   positiveInt,
//   requiredString,
//   SchemaGenerator,
// } from '../utils/shemaHandler.js';

// const baseUserBody = z
//   .object({
//     kpi_name: requiredString('Nama KPI').min(3, 'Nama KPI minimal 3 karakter.'),
//     target_value: positiveInt('Nilai target'),
//     period_start: z.coerce.date({
//       error: 'Tanggal mulai periode wajib diisi.',
//     }),
//     period_end: z.coerce.date({
//       error: 'Tanggal akhir periode wajib diisi.',
//     }),
//     energy_type_id: positiveInt('ID tipe energi'),
//   })
//   .refine((data) => data.period_end >= data.period_start, {
//     message: 'Tanggal akhir periode tidak boleh lebih awal dari tanggal mulai.',
//     path: ['period_end'],
//   });

// export const crudSchemas =new  SchemaGenerator('targetId', baseUserBody);

// export const createEfficiencyTargetSchema = crudSchemas.create;
// export const updateEfficiencyTargetSchema = crudSchemas.update;

// export const efficiencyTargetParamsSchema = z.object({
//   params: z.object({
//     target_id: positiveInt('ID target'),
//   }),
// });
