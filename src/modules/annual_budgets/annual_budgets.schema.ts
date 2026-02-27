import { z } from 'zod';

// 1. Definisikan Shape dasar tanpa transformasi untuk digunakan kembali
const rawAllocationShape = z.object({
  meter_id: z.number().int(),
  allocated_amount: z.coerce.number().min(0),
  allocated_volume: z.coerce.number().min(0),
  monthly_distribution_profile: z.record(z.string(), z.number()).optional(),
});

// 2. Buat fungsi helper untuk transformasi agar reusable
const autoDistribute = (data: any) => {
  if (!data.monthly_distribution_profile && data.allocated_amount) {
    const val = Number((data.allocated_amount / 12).toFixed(2));
    data.monthly_distribution_profile = {
      jan: val,
      feb: val,
      mar: val,
      apr: val,
      may: val,
      jun: val,
      jul: val,
      aug: val,
      sep: val,
      oct: val,
      nov: val,
      dec: val,
    };
  }
  return data;
};

// 3. Allocation Shape dengan transformasi
const allocationSchema = rawAllocationShape.transform(autoDistribute);

const budgetShape = {
  fiscal_year: z.coerce.number().int().min(2000).max(2100),
  energy_type_id: z.number().int().positive(),
  name: z.string().min(1, 'Nama anggaran wajib diisi'),
  total_amount: z.coerce.number().min(0),
  total_volume: z.coerce.number().min(0),
  efficiency_target_percentage: z.coerce.number().min(0).max(1).optional().nullable(),
  description: z.string().optional().nullable(),
};

export const budgetSchema = {
  store: z.object({
    body: z.object({
      budget: z.object({
        ...budgetShape,
        allocations: z
          .object({
            // Menggunakan allocationSchema yang sudah ada transform-nya
            create: z.array(allocationSchema),
          })
          .optional(),
      }),
    }),
  }),

  show: z.object({
    params: z.object({
      id: z.coerce.number().int().optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      search: z.string().optional(),
      year: z.coerce.number().optional(),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
    body: z.object({
      budget: z
        .object({
          ...budgetShape,
          allocations: z
            .object({
              upsert: z.array(
                z.object({
                  where: z.object({ allocation_id: z.number().int() }),
                  // Gunakan raw shape lalu panggil transform manual via .transform()
                  // agar logic bagi 12 tetap jalan saat update
                  update: rawAllocationShape.partial().transform(autoDistribute),
                  create: rawAllocationShape.transform(autoDistribute),
                }),
              ),
            })
            .optional(),
        })
        .partial(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
  }),
  showRemaining: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
  }),
};
