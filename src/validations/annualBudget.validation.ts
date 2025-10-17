import { z } from 'zod';
import { positiveInt, positiveNumber } from './schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

const annualBudgetParamsSchema = z.object({
  budgetId: positiveInt('Budget ID'),
});

const annualBudgetBodySchema = z
  .object({
    // PERBAIKAN: Ganti 'year' dengan periode yang lebih fleksibel
    period_start: z.coerce.date({
      message: 'Tanggal mulai periode tidak valid.',
    }),
    period_end: z.coerce.date({
      message: 'Tanggal akhir periode tidak valid.',
    }),
    total_budget: positiveNumber('Total Budget'),
    efficiency_tag: positiveNumber('Efficiency Tag').min(0).max(1).optional(),
    // BARU: Wajibkan energy_type_id saat membuat atau memperbarui
    energy_type_id: positiveInt('Energy Type ID'),
    // BARU: Tambahkan parent_budget_id untuk mendukung hierarki anggaran
    parent_budget_id: positiveInt('Parent Budget ID').optional().nullable(),
    // BARU: Wajibkan array alokasi saat membuat
    allocations: z.array(
      z.object({
        meter_id: positiveInt('Meter ID dalam alokasi'),
        weight: positiveNumber('Bobot alokasi').min(0).max(1),
      }),
      { message: 'Alokasi harus berupa array.' }
    ),
  })
  .refine((data) => data.period_end > data.period_start, {
    message: 'Tanggal akhir periode harus setelah tanggal mulai.',
    path: ['period_end'],
  })
  .refine(
    (data) => {
      // Jika ini adalah anggaran anak (memiliki parent_budget_id), validasi bobot dan alokasi.
      if (data.parent_budget_id) {
        if (data.allocations.length === 0) {
          return false; // Anggaran anak wajib punya alokasi
        }
        const totalWeight = data.allocations.reduce(
          (sum, alloc) => sum + alloc.weight,
          0
        );
        // Izinkan toleransi kecil untuk masalah floating point
        return Math.abs(totalWeight - 1) < 0.001;
      }
      // Jika ini adalah anggaran induk, tidak perlu validasi bobot.
      return true;
    },
    {
      message:
        'Untuk anggaran periode (anak), minimal harus ada satu alokasi dan total bobotnya harus 100%.',
      path: ['allocations'], // Tampilkan error pada field alokasi
    }
  );

export const annualBudgetSchema = new CrudSchemaBuilder({
  bodySchema: annualBudgetBodySchema,
  // createSchema: annualBudgetBodySchema,
  // updateSchema: annualBudgetBodySchema,
  paramsSchema: annualBudgetParamsSchema,
});

export const queryAnnualBudget = z.object({
  query: z.object({
    // PERBAIKAN: Ganti filter 'year' dengan 'date' untuk mencari anggaran aktif pada tanggal tertentu
    date: z.string().date('Format tanggal tidak valid.').optional(),
  }),
});
