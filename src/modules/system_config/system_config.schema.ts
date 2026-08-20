import { z } from 'zod';

export const updateSystemConfigSchema = z.object({
  body: z.object({
    endpoints: z
      .object({
        active_environment: z.enum(['development', 'production']).default('development'),
        development: z
          .object({
            backend_api_url: z.string().optional(),
            ml_api_base_url: z.string().optional(),
          })
          .optional(),
        production: z
          .object({
            backend_api_url: z.string().optional(),
            ml_api_base_url: z.string().optional(),
          })
          .optional(),
        backend_api_url: z.string().optional(),
        ml_api_base_url: z.string().optional(),
      })
      .optional(),

    security: z
      .object({
        jwt_secret: z.string().min(1, 'JWT Secret wajib diisi'),
        uploadthing_app_id: z.string().optional().nullable(),
        uploadthing_secret: z.string().optional().nullable(),
        uploadthing_token: z.string().optional().nullable(),
      })
      .optional(),

    weather: z
      .object({
        airport_name: z.string().optional().default('Bandara Sultan Thaha Jambi'),
        latitude: z.coerce.number(),
        longitude: z.coerce.number(),
        openweather_api_key: z.string().optional().default(''),
      })
      .optional(),

    dashboardCards: z
      .object({
        electricityMeterIds: z.array(z.coerce.number().int().positive()).optional().default([]),
        waterMeterIds: z.array(z.coerce.number().int().positive()).optional().default([]),
        fuelMeterIds: z.array(z.coerce.number().int().positive()).optional().default([]),
      })
      .optional(),
  }),
});

export const testMlSchema = z.object({
  body: z.object({
    url: z.string().optional(),
  }),
});

export const testWeatherSchema = z.object({
  body: z.object({
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    apiKey: z.string().optional(),
  }),
});

export const importPackageSchema = z.object({
  body: z.object({
    mode: z.enum(['MERGE_UPSERT', 'CLEAN_IMPORT']).default('MERGE_UPSERT'),
    package: z.object({
      version: z.string().optional(),
      data: z.object({
        energies: z.array(z.any()).optional().default([]),
        reading_types: z.array(z.any()).optional().default([]),
        locations: z.array(z.any()).optional().default([]),
        tenants: z.array(z.any()).optional().default([]),
        price_schemes: z.array(z.any()).optional().default([]),
        calculation_templates: z.array(z.any()).optional().default([]),
        meters: z.array(z.any()).optional().default([]),
        efficiency_targets: z.array(z.any()).optional().default([]),
        annual_budgets: z.array(z.any()).optional().default([]),
      }),
    }),
  }),
});
