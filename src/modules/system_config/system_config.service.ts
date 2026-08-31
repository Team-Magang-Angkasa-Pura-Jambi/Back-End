import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import prisma from '../../configs/db.js';
import {
  FullSystemConfigPayload,
  MasterPackageExportData,
  SystemConfigResponse,
} from './system_config.types.js';

const SETTING_KEY = 'SYSTEM_GLOBAL_CONFIG';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_CONFIG_PATH = path.resolve(__dirname, '../../configs/system_global_config.json');

const getDefaultConfig = (): FullSystemConfigPayload => {
  return {
    endpoints: {
      active_environment: 'development',
      development: {
        backend_api_url: process.env.NEXT_PUBLIC_API_URL_DEVELOPMENT || 'http://localhost:8080/api/v2',
        ml_api_base_url: process.env.ML_API_BASE_URL || 'http://localhost:8000',
      },
      production: {
        backend_api_url: process.env.NEXT_PUBLIC_API_URL_PRODUCTION || 'https://sentinel.angkasapura2.co.id/api/v2',
        ml_api_base_url: 'https://sentinel-ml.angkasapura2.co.id',
      },
      backend_api_url: process.env.NEXT_PUBLIC_API_URL_DEVELOPMENT || 'http://localhost:8080/api/v2',
      ml_api_base_url: process.env.ML_API_BASE_URL || 'http://localhost:8000',
    },
    security: {
      jwt_secret: process.env.JWT_SECRET || 'SENTINELxANGKASAPURADJB',
      uploadthing_app_id: process.env.UPLOADTHING_APP_ID || '',
      uploadthing_secret: process.env.UPLOADTHING_SECRET || '',
      uploadthing_token: process.env.UPLOADTHING_TOKEN || '',
    },
    weather: {
      airport_name: 'Bandara Sultan Thaha Jambi',
      latitude: Number(process.env.OPENWEATHER_LATITUDE ?? -1.63806),
      longitude: Number(process.env.OPENWEATHER_LONGITUDE ?? 103.6444),
      openweather_api_key: process.env.OPENWEATHER_API_KEY || '6953d3a5c74bbd94157aa3455bd9dd87',
    },
    dashboardCards: {
      electricityMeterIds: [],
      waterMeterIds: [],
      fuelMeterIds: [],
    },
    ai: {
      google_generative_ai_api_key: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    },
  };
};

const readFallbackFile = (): FullSystemConfigPayload => {
  try {
    if (fs.existsSync(FALLBACK_CONFIG_PATH)) {
      const raw = fs.readFileSync(FALLBACK_CONFIG_PATH, 'utf-8');
      return { ...getDefaultConfig(), ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('[SystemConfig] Gagal membaca fallback file:', err);
  }
  return getDefaultConfig();
};

const writeFallbackFile = (config: FullSystemConfigPayload) => {
  try {
    const dir = path.dirname(FALLBACK_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SystemConfig] Gagal menulis fallback file:', err);
  }
};

/**
 * Helper to safely serialize Prisma models containing Decimal, Date, and BigInt
 */
const serializePrismaData = <T = any>(data: T): T => {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
        return value.toNumber();
      }
      return value;
    })
  );
};

export const systemConfigService = {
  getConfig: async (): Promise<FullSystemConfigPayload> => {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: SETTING_KEY },
      });

      if (setting && setting.value) {
        const val = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
        const defaultConfig = getDefaultConfig();

        return {
          endpoints: {
            active_environment: val.endpoints?.active_environment || defaultConfig.endpoints.active_environment,
            development: { ...defaultConfig.endpoints.development, ...(val.endpoints?.development || {}) },
            production: { ...defaultConfig.endpoints.production, ...(val.endpoints?.production || {}) },
            backend_api_url:
              val.endpoints?.active_environment === 'production'
                ? val.endpoints?.production?.backend_api_url || defaultConfig.endpoints.production.backend_api_url
                : val.endpoints?.development?.backend_api_url || defaultConfig.endpoints.development.backend_api_url,
            ml_api_base_url:
              val.endpoints?.active_environment === 'production'
                ? val.endpoints?.production?.ml_api_base_url || defaultConfig.endpoints.production.ml_api_base_url
                : val.endpoints?.development?.ml_api_base_url || defaultConfig.endpoints.development.ml_api_base_url,
          },
          security: { ...defaultConfig.security, ...(val.security || {}) },
          weather: { ...defaultConfig.weather, ...(val.weather || {}) },
          dashboardCards: { ...defaultConfig.dashboardCards, ...(val.dashboardCards || {}) },
          ai: { ...defaultConfig.ai, ...(val.ai || {}) },
        };
      }
    } catch (error) {
      return readFallbackFile();
    }

    return readFallbackFile();
  },

  updateConfig: async (
    payload: Partial<FullSystemConfigPayload>,
    userId?: number,
  ): Promise<FullSystemConfigPayload> => {
    const current = await systemConfigService.getConfig();

    const activeEnv = payload.endpoints?.active_environment || current.endpoints.active_environment || 'development';
    const devEndpoints = { ...current.endpoints.development, ...(payload.endpoints?.development || {}) };
    const prodEndpoints = { ...current.endpoints.production, ...(payload.endpoints?.production || {}) };

    const activeBackendUrl =
      activeEnv === 'production' ? prodEndpoints.backend_api_url : devEndpoints.backend_api_url;
    const activeMlUrl =
      activeEnv === 'production' ? prodEndpoints.ml_api_base_url : devEndpoints.ml_api_base_url;

    const mergedConfig: FullSystemConfigPayload = {
      endpoints: {
        active_environment: activeEnv,
        development: devEndpoints,
        production: prodEndpoints,
        backend_api_url: activeBackendUrl,
        ml_api_base_url: activeMlUrl,
      },
      security: {
        ...current.security,
        ...(payload.security || {}),
      },
      weather: {
        ...current.weather,
        ...(payload.weather || {}),
      },
      dashboardCards: {
        electricityMeterIds: (
          payload.dashboardCards?.electricityMeterIds ?? current.dashboardCards.electricityMeterIds
        ).map(Number),
        waterMeterIds: (
          payload.dashboardCards?.waterMeterIds ?? current.dashboardCards.waterMeterIds
        ).map(Number),
        fuelMeterIds: (
          payload.dashboardCards?.fuelMeterIds ?? current.dashboardCards.fuelMeterIds
        ).map(Number),
      },
      ai: {
        ...current.ai,
        ...(payload.ai || {}),
      } as any,
    };

    writeFallbackFile(mergedConfig);

    try {
      await prisma.systemSetting.upsert({
        where: { key: SETTING_KEY },
        update: {
          value: mergedConfig as any,
          description: 'Pengaturan Global Sistem (Dev/Prod Endpoints, Security, Weather, Dashboard Cards)',
          updated_by: userId,
        },
        create: {
          key: SETTING_KEY,
          value: mergedConfig as any,
          description: 'Pengaturan Global Sistem (Dev/Prod Endpoints, Security, Weather, Dashboard Cards)',
          updated_by: userId,
        },
      });
    } catch (error) {
      console.warn('[SystemConfig] Gagal menyimpan ke database system_settings, fallback file digunakan:', error);
    }

    return mergedConfig;
  },

  getFullSettingsWithMeters: async (): Promise<SystemConfigResponse> => {
    const [config, allMeters] = await Promise.all([
      systemConfigService.getConfig(),
      prisma.meter.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          meter_id: true,
          meter_code: true,
          name: true,
          category: true,
          energy_type_id: true,
          energy_type: {
            select: {
              name: true,
            },
          },
          location: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ energy_type_id: 'asc' }, { meter_code: 'asc' }],
      }),
    ]);

    const categorizedMeters = {
      electricity: allMeters.filter((m) => m.energy_type?.name?.toLowerCase() === 'electricity'),
      water: allMeters.filter((m) => m.energy_type?.name?.toLowerCase() === 'water'),
      fuel: allMeters.filter((m) => m.energy_type?.name?.toLowerCase() === 'fuel'),
    };

    return {
      config,
      availableMeters: categorizedMeters,
      server_info: {
        node_env: process.env.NODE_ENV || 'development',
        port: Number(process.env.PORT || 8080),
        uptime_seconds: Math.floor(process.uptime()),
      },
    };
  },

  testMlConnection: async (urlOverride?: string) => {
    const config = await systemConfigService.getConfig();
    const targetUrl = urlOverride || config.endpoints.ml_api_base_url;

    try {
      const response = await axios.get(`${targetUrl}/health`, { timeout: 4000 });
      return {
        success: true,
        message: 'Koneksi ke Microservice Machine Learning (FastAPI) Berhasil!',
        targetUrl,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Gagal terhubung ke ML Service (${targetUrl}): ${error.message}`,
        targetUrl,
      };
    }
  },

  testWeatherConnection: async (lat?: number, lon?: number, key?: string) => {
    const config = await systemConfigService.getConfig();
    const targetLat = lat ?? config.weather.latitude;
    const targetLon = lon ?? config.weather.longitude;
    const targetKey = key || config.weather.openweather_api_key;

    if (!targetKey) {
      return {
        success: false,
        message: 'API Key OpenWeather belum diisi.',
      };
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${targetLat}&lon=${targetLon}&appid=${targetKey}&units=metric&lang=id`;
      const response = await axios.get(url, { timeout: 5000 });

      return {
        success: true,
        message: `Koneksi OpenWeather API Berhasil! Cuaca saat ini: ${response.data.weather?.[0]?.description || '-'}, Suhu: ${response.data.main?.temp}°C`,
        data: {
          location: response.data.name,
          temp: response.data.main?.temp,
          humidity: response.data.main?.humidity,
          condition: response.data.weather?.[0]?.description,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Gagal memverifikasi API OpenWeather: ${error?.response?.data?.message || error.message}`,
      };
    }
  },

  // EXPORT MASTER DATA & CALCULATION ENGINE PACKAGE
  exportMasterPackage: async (userId?: number): Promise<MasterPackageExportData> => {
    const config = await systemConfigService.getConfig();

    const [
      energies,
      readingTypes,
      locations,
      tenants,
      priceSchemes,
      calcTemplates,
      meters,
      efficiencyTargets,
      annualBudgets,
    ] = await Promise.all([
      prisma.energyType.findMany({ orderBy: { energy_type_id: 'asc' } }),
      prisma.readingType.findMany({ orderBy: { reading_type_id: 'asc' } }),
      prisma.location.findMany({ orderBy: { location_id: 'asc' } }),
      prisma.tenant.findMany({ orderBy: { tenant_id: 'asc' } }),
      prisma.priceScheme.findMany({
        include: { rates: true },
        orderBy: { scheme_id: 'asc' },
      }),
      prisma.calculationTemplate.findMany({
        include: { definitions: true },
        orderBy: { created_at: 'asc' },
      }),
      prisma.meter.findMany({
        include: {
          tank_profile: true,
          reading_configs: true,
        },
        orderBy: { meter_id: 'asc' },
      }),
      prisma.efficiencyTarget.findMany({ orderBy: { target_id: 'asc' } }),
      prisma.annualBudget.findMany({ orderBy: { budget_id: 'asc' } }),
    ]);

    const counts = {
      energies: energies.length,
      reading_types: readingTypes.length,
      locations: locations.length,
      tenants: tenants.length,
      price_schemes: priceSchemes.length,
      calculation_templates: calcTemplates.length,
      meters: meters.length,
      efficiency_targets: efficiencyTargets.length,
      annual_budgets: annualBudgets.length,
    };

    const exportBundle = {
      version: '2.0-SENTINEL',
      exported_at: new Date().toISOString(),
      environment: config.endpoints.active_environment,
      exported_by: {
        user_id: userId,
      },
      counts,
      data: {
        energies,
        reading_types: readingTypes,
        locations,
        tenants,
        price_schemes: priceSchemes,
        calculation_templates: calcTemplates,
        meters,
        efficiency_targets: efficiencyTargets,
        annual_budgets: annualBudgets,
      },
    };

    return serializePrismaData(exportBundle);
  },

  // IMPORT MASTER DATA & CALCULATION ENGINE PACKAGE
  importMasterPackage: async (
    payload: {
      mode?: 'MERGE_UPSERT' | 'CLEAN_IMPORT';
      package: any;
    },
    userId?: number,
  ) => {
    const pkg = payload.package;
    if (!pkg || !pkg.data) {
      throw new Error('Paket data import tidak valid atau kosong.');
    }

    const {
      energies = [],
      reading_types = [],
      locations = [],
      tenants = [],
      price_schemes = [],
      calculation_templates = [],
      meters = [],
      efficiency_targets = [],
      annual_budgets = [],
    } = pkg.data;

    let importedCounts = {
      energies: 0,
      reading_types: 0,
      locations: 0,
      tenants: 0,
      price_schemes: 0,
      calculation_templates: 0,
      meters: 0,
      efficiency_targets: 0,
      annual_budgets: 0,
    };

    await prisma.$transaction(async (tx) => {
      // 1. Energies
      for (const e of energies) {
        if (e.name) {
          await tx.energyType.upsert({
            where: { name: e.name },
            update: {
              unit_standard: e.unit_standard || 'unit',
            },
            create: {
              name: e.name,
              unit_standard: e.unit_standard || 'unit',
            },
          });
          importedCounts.energies++;
        }
      }

      // 2. Reading Types
      for (const rt of reading_types) {
        if (rt.type_name && rt.energy_type_id) {
          const existing = await tx.readingType.findFirst({
            where: { type_name: rt.type_name, energy_type_id: rt.energy_type_id },
          });

          if (existing) {
            await tx.readingType.update({
              where: { reading_type_id: existing.reading_type_id },
              data: {
                unit: rt.unit || 'unit',
              },
            });
          } else {
            await tx.readingType.create({
              data: {
                energy_type_id: rt.energy_type_id,
                type_name: rt.type_name,
                unit: rt.unit || 'unit',
              },
            });
          }
          importedCounts.reading_types++;
        }
      }

      // 3. Locations
      for (const loc of locations) {
        if (loc.name) {
          const existing = await tx.location.findFirst({
            where: { name: loc.name },
          });
          if (existing) {
            await tx.location.update({
              where: { location_id: existing.location_id },
              data: {
                parent_id: loc.parent_id || null,
                updated_by: userId,
              },
            });
          } else {
            await tx.location.create({
              data: {
                name: loc.name,
                parent_id: loc.parent_id || null,
                created_by: userId,
              },
            });
          }
          importedCounts.locations++;
        }
      }

      // 4. Tenants
      for (const ten of tenants) {
        if (ten.name) {
          await tx.tenant.upsert({
            where: { name: ten.name },
            update: {
              category: ten.category || null,
              contact_person: ten.contact_person || null,
              email: ten.email || null,
              phone: ten.phone || null,
              updated_by: userId,
            },
            create: {
              name: ten.name,
              category: ten.category || null,
              contact_person: ten.contact_person || null,
              email: ten.email || null,
              phone: ten.phone || null,
              created_by: userId,
            },
          });
          importedCounts.tenants++;
        }
      }

      // 5. Price Schemes & Scheme Rates
      for (const ps of price_schemes) {
        if (ps.name) {
          const existing = await tx.priceScheme.findFirst({
            where: { name: ps.name },
            include: { rates: true },
          });

          let schemeId = existing?.scheme_id;

          if (existing) {
            await tx.priceScheme.update({
              where: { scheme_id: existing.scheme_id },
              data: {
                description: ps.description || null,
                effective_date: ps.effective_date ? new Date(ps.effective_date) : new Date(),
                is_active: ps.is_active ?? true,
                updated_by: userId,
              },
            });
            schemeId = existing.scheme_id;
          } else {
            const created = await tx.priceScheme.create({
              data: {
                name: ps.name,
                description: ps.description || null,
                effective_date: ps.effective_date ? new Date(ps.effective_date) : new Date(),
                is_active: ps.is_active ?? true,
                created_by: userId,
              },
            });
            schemeId = created.scheme_id;
          }

          // Insert or update rates if available
          if (ps.rates && Array.isArray(ps.rates) && schemeId) {
            for (const r of ps.rates) {
              if (r.reading_type_id && r.rate_value !== undefined) {
                const existingRate = await tx.schemeRate.findFirst({
                  where: { scheme_id: schemeId, reading_type_id: r.reading_type_id },
                });
                if (existingRate) {
                  await tx.schemeRate.update({
                    where: { rate_id: existingRate.rate_id },
                    data: { rate_value: r.rate_value },
                  });
                } else {
                  await tx.schemeRate.create({
                    data: {
                      scheme_id: schemeId,
                      reading_type_id: r.reading_type_id,
                      rate_value: r.rate_value,
                    },
                  });
                }
              }
            }
          }

          importedCounts.price_schemes++;
        }
      }

      // 6. Calculation Templates & Sub-Definitions
      for (const tmpl of calculation_templates) {
        if (tmpl.name) {
          const existing = await tx.calculationTemplate.findFirst({
            where: { name: tmpl.name },
            include: { definitions: true },
          });

          let templateId = existing?.template_id;

          if (existing) {
            await tx.calculationTemplate.update({
              where: { template_id: existing.template_id },
              data: {
                description: tmpl.description || null,
                validations: tmpl.validations || null,
                updated_by: userId,
              },
            });

            // Recreate formula definitions
            await tx.formulaDefinition.deleteMany({
              where: { template_id: existing.template_id },
            });
          } else {
            const created = await tx.calculationTemplate.create({
              data: {
                template_id: tmpl.template_id || undefined,
                name: tmpl.name,
                description: tmpl.description || null,
                validations: tmpl.validations || null,
                created_by: userId,
              },
            });
            templateId = created.template_id;
          }

          if (tmpl.definitions && Array.isArray(tmpl.definitions) && templateId) {
            for (const def of tmpl.definitions) {
              await tx.formulaDefinition.create({
                data: {
                  template_id: templateId,
                  name: def.name,
                  is_main: def.is_main ?? false,
                  formula_items: def.formula_items || { formula: '', variables: [] },
                },
              });
            }
          }
          importedCounts.calculation_templates++;
        }
      }

      // 7. Meters & Tank Profiles & Meter Reading Configs
      for (const m of meters) {
        if (m.meter_code && m.name) {
          const existing = await tx.meter.findUnique({
            where: { meter_code: m.meter_code },
          });

          let meterId = existing?.meter_id;

          const meterData = {
            name: m.name,
            meter_code: m.meter_code,
            serial_number: m.serial_number || null,
            tenant_id: m.tenant_id || null,
            location_id: m.location_id || null,
            calculation_template_id: m.calculation_template_id || null,
            price_scheme_id: m.price_scheme_id || null,
            energy_type_id: m.energy_type_id || 1,
            category: m.category || 'LAINNYA',
            status: m.status || 'ACTIVE',
            is_virtual: m.is_virtual ?? false,
            multiplier: m.multiplier ?? 1.0,
            allow_gap: m.allow_gap ?? false,
            allow_decrease: m.allow_decrease ?? false,
            rollover_limit: m.rollover_limit || null,
            updated_by: userId,
          };

          if (existing) {
            await tx.meter.update({
              where: { meter_id: existing.meter_id },
              data: meterData,
            });
          } else {
            const created = await tx.meter.create({
              data: {
                ...meterData,
                created_by: userId,
              },
            });
            meterId = created.meter_id;
          }

          // Handle Tank Profile
          if (m.tank_profile && meterId) {
            const existingTank = await tx.tankProfile.findUnique({
              where: { meter_id: meterId },
            });

            const tankData = {
              shape: m.tank_profile.shape || 'CYLINDER_VERTICAL',
              height_max_cm: m.tank_profile.height_max_cm || 0,
              length_cm: m.tank_profile.length_cm || null,
              width_cm: m.tank_profile.width_cm || null,
              diameter_cm: m.tank_profile.diameter_cm || null,
              capacity_liters: m.tank_profile.capacity_liters || 0,
            };

            if (existingTank) {
              await tx.tankProfile.update({
                where: { meter_id: meterId },
                data: { ...tankData, updated_by: userId },
              });
            } else {
              await tx.tankProfile.create({
                data: { ...tankData, meter_id: meterId, created_by: userId },
              });
            }
          }

          importedCounts.meters++;
        }
      }

      // Log to Audit Log
      await tx.auditLog.create({
        data: {
          action: 'IMPORT',
          entity_table: 'MasterDataPackage',
          entity_id: '1',
          old_values: undefined,
          new_values: {
            mode: payload.mode || 'MERGE_UPSERT',
            source_version: pkg.version,
            source_env: pkg.environment,
            imported_counts: importedCounts,
          },
          user_id: userId ?? 1,
        },
      });
    });

    return {
      success: true,
      message: 'Impor paket Data Master & Kalkulasi berhasil disinkronkan!',
      importedCounts,
    };
  },
};
