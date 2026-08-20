import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma, { ensureSystemSettingsTable } from '../../configs/db.js';

export interface CardDetailConfig {
  show: boolean;
  title: string;
  meterIds?: number[];
}

export interface FullDashboardVisualConfig {
  cards: {
    electricity: CardDetailConfig;
    water: CardDetailConfig;
    fuel: CardDetailConfig;
    pax: { show: boolean; title: string };
    weather: { show: boolean; title: string };
  };
  yearly_heatmap: {
    show: boolean;
    title: string;
    meter_ids: number[];
    default_meter_id?: number | null;
  };
  trend_analysis: {
    show: boolean;
    title: string;
    meter_ids: number[];
    default_energy_id: number;
    default_meter_id?: number | null;
  };
  fuel_logistics: {
    show: boolean;
    title: string;
    meter_ids: number[];
    default_meter_id?: number | null;
  };
  yearly_spending: {
    show: boolean;
    title: string;
    default_energy_id: number;
  };
  pax_correlation: {
    show: boolean;
    title: string;
    default_energy_id: number;
  };
  electricityMeterIds?: number[];
  waterMeterIds?: number[];
  fuelMeterIds?: number[];
  electricity?: CardDetailConfig;
  water?: CardDetailConfig;
  fuel?: CardDetailConfig;
  pax?: { show: boolean; title: string };
  weather?: { show: boolean; title: string };
}

const SETTING_KEY = 'DASHBOARD_VISUAL_CONFIG';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_CONFIG_PATH = path.resolve(__dirname, '../../configs/dashboard_visual_config.json');

const getDefaultConfig = (): FullDashboardVisualConfig => ({
  cards: {
    electricity: { show: true, title: 'Listrik', meterIds: [] },
    water: { show: true, title: 'Air', meterIds: [] },
    fuel: { show: true, title: 'BBM', meterIds: [] },
    pax: { show: true, title: 'Penumpang (PAX)' },
    weather: { show: true, title: 'Cuaca & Suhu' },
  },
  yearly_heatmap: {
    show: true,
    title: 'Health Check: Indeks Efisiensi Harian',
    meter_ids: [],
    default_meter_id: null,
  },
  trend_analysis: {
    show: true,
    title: 'Analisis Tren Konsumsi',
    meter_ids: [],
    default_energy_id: 1,
    default_meter_id: null,
  },
  fuel_logistics: {
    show: true,
    title: 'Analisis Logistik & Sisa Stok BBM',
    meter_ids: [],
    default_meter_id: null,
  },
  yearly_spending: {
    show: true,
    title: 'Tren Pengeluaran Tahunan',
    default_energy_id: 1,
  },
  pax_correlation: {
    show: true,
    title: 'Korelasi Beban Operasional',
    default_energy_id: 1,
  },
  electricityMeterIds: [],
  waterMeterIds: [],
  fuelMeterIds: [],
});

const readFallbackFile = (): FullDashboardVisualConfig => {
  try {
    if (fs.existsSync(FALLBACK_CONFIG_PATH)) {
      const raw = fs.readFileSync(FALLBACK_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      const def = getDefaultConfig();

      const cardsData = parsed.cards || {
        electricity: parsed.electricity || def.cards.electricity,
        water: parsed.water || def.cards.water,
        fuel: parsed.fuel || def.cards.fuel,
        pax: parsed.pax || def.cards.pax,
        weather: parsed.weather || def.cards.weather,
      };

      const elecIds = Array.isArray(cardsData.electricity?.meterIds)
        ? cardsData.electricity.meterIds
        : parsed.electricityMeterIds || [];
      const waterIds = Array.isArray(cardsData.water?.meterIds)
        ? cardsData.water.meterIds
        : parsed.waterMeterIds || [];
      const fuelIds = Array.isArray(cardsData.fuel?.meterIds)
        ? cardsData.fuel.meterIds
        : parsed.fuelMeterIds || [];

      return {
        ...def,
        ...parsed,
        cards: {
          electricity: { ...def.cards.electricity, ...(cardsData.electricity || {}), meterIds: elecIds },
          water: { ...def.cards.water, ...(cardsData.water || {}), meterIds: waterIds },
          fuel: { ...def.cards.fuel, ...(cardsData.fuel || {}), meterIds: fuelIds },
          pax: { ...def.cards.pax, ...(cardsData.pax || {}) },
          weather: { ...def.cards.weather, ...(cardsData.weather || {}) },
        },
        yearly_heatmap: {
          ...def.yearly_heatmap,
          ...(parsed.yearly_heatmap || {}),
          meter_ids: Array.isArray(parsed.yearly_heatmap?.meter_ids) ? parsed.yearly_heatmap.meter_ids : [],
        },
        trend_analysis: {
          ...def.trend_analysis,
          ...(parsed.trend_analysis || {}),
          meter_ids: Array.isArray(parsed.trend_analysis?.meter_ids) ? parsed.trend_analysis.meter_ids : [],
        },
        fuel_logistics: {
          ...def.fuel_logistics,
          ...(parsed.fuel_logistics || {}),
          meter_ids: Array.isArray(parsed.fuel_logistics?.meter_ids) ? parsed.fuel_logistics.meter_ids : [],
        },
        yearly_spending: { ...def.yearly_spending, ...(parsed.yearly_spending || {}) },
        pax_correlation: { ...def.pax_correlation, ...(parsed.pax_correlation || {}) },
        electricityMeterIds: elecIds,
        waterMeterIds: waterIds,
        fuelMeterIds: fuelIds,
      };
    }
  } catch (err) {
    console.warn('[DashboardConfig] Error reading fallback file:', err);
  }
  return getDefaultConfig();
};

const writeFallbackFile = (config: FullDashboardVisualConfig) => {
  try {
    const dir = path.dirname(FALLBACK_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[DashboardConfig] Error writing fallback file:', err);
  }
};

export const dashboardConfigService = {
  getCardConfig: async (): Promise<FullDashboardVisualConfig> => {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: SETTING_KEY },
      });

      if (setting && setting.value) {
        const val = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
        const def = getDefaultConfig();

        const cardsData = val.cards || {
          electricity: val.electricity || def.cards.electricity,
          water: val.water || def.cards.water,
          fuel: val.fuel || def.cards.fuel,
          pax: val.pax || def.cards.pax,
          weather: val.weather || def.cards.weather,
        };

        const elecIds = Array.isArray(cardsData.electricity?.meterIds)
          ? cardsData.electricity.meterIds
          : val.electricityMeterIds || [];
        const waterIds = Array.isArray(cardsData.water?.meterIds)
          ? cardsData.water.meterIds
          : val.waterMeterIds || [];
        const fuelIds = Array.isArray(cardsData.fuel?.meterIds)
          ? cardsData.fuel.meterIds
          : val.fuelMeterIds || [];

        return {
          cards: {
            electricity: {
              show: cardsData.electricity?.show ?? true,
              title: cardsData.electricity?.title ?? 'Listrik',
              meterIds: elecIds,
            },
            water: {
              show: cardsData.water?.show ?? true,
              title: cardsData.water?.title ?? 'Air',
              meterIds: waterIds,
            },
            fuel: {
              show: cardsData.fuel?.show ?? true,
              title: cardsData.fuel?.title ?? 'BBM',
              meterIds: fuelIds,
            },
            pax: {
              show: cardsData.pax?.show ?? true,
              title: cardsData.pax?.title ?? 'Penumpang (PAX)',
            },
            weather: {
              show: cardsData.weather?.show ?? true,
              title: cardsData.weather?.title ?? 'Cuaca & Suhu',
            },
          },
          yearly_heatmap: {
            show: val.yearly_heatmap?.show ?? true,
            title: val.yearly_heatmap?.title ?? 'Health Check: Indeks Efisiensi Harian',
            meter_ids: Array.isArray(val.yearly_heatmap?.meter_ids) ? val.yearly_heatmap.meter_ids : [],
            default_meter_id: val.yearly_heatmap?.default_meter_id ?? null,
          },
          trend_analysis: {
            show: val.trend_analysis?.show ?? true,
            title: val.trend_analysis?.title ?? 'Analisis Tren Konsumsi',
            meter_ids: Array.isArray(val.trend_analysis?.meter_ids) ? val.trend_analysis.meter_ids : [],
            default_energy_id: val.trend_analysis?.default_energy_id ?? 1,
            default_meter_id: val.trend_analysis?.default_meter_id ?? null,
          },
          fuel_logistics: {
            show: val.fuel_logistics?.show ?? true,
            title: val.fuel_logistics?.title ?? 'Analisis Logistik & Sisa Stok BBM',
            meter_ids: Array.isArray(val.fuel_logistics?.meter_ids) ? val.fuel_logistics.meter_ids : [],
            default_meter_id: val.fuel_logistics?.default_meter_id ?? null,
          },
          yearly_spending: {
            show: val.yearly_spending?.show ?? true,
            title: val.yearly_spending?.title ?? 'Tren Pengeluaran Tahunan',
            default_energy_id: val.yearly_spending?.default_energy_id ?? 1,
          },
          pax_correlation: {
            show: val.pax_correlation?.show ?? true,
            title: val.pax_correlation?.title ?? 'Korelasi Beban Operasional',
            default_energy_id: val.pax_correlation?.default_energy_id ?? 1,
          },
          electricityMeterIds: elecIds,
          waterMeterIds: waterIds,
          fuelMeterIds: fuelIds,
        };
      }
    } catch (error) {
      return readFallbackFile();
    }

    return readFallbackFile();
  },

  updateCardConfig: async (
    config: any = {},
    userId?: number,
  ): Promise<FullDashboardVisualConfig> => {
    try {
      const def = getDefaultConfig();
      const current = await dashboardConfigService.getCardConfig();

      const cardsInput = config.cards || config || {};

      const parseIds = (val: any, fallback: number[] = []): number[] => {
        if (Array.isArray(val)) {
          return val.map((x) => Number(x)).filter((x) => !isNaN(x));
        }
        return fallback;
      };

      const elecMeterIds = parseIds(
        cardsInput.electricity?.meterIds ?? config.electricityMeterIds,
        current?.cards?.electricity?.meterIds || []
      );

      const waterMeterIds = parseIds(
        cardsInput.water?.meterIds ?? config.waterMeterIds,
        current?.cards?.water?.meterIds || []
      );

      const fuelMeterIds = parseIds(
        cardsInput.fuel?.meterIds ?? config.fuelMeterIds,
        current?.cards?.fuel?.meterIds || []
      );

      const cleanConfig: FullDashboardVisualConfig = {
        cards: {
          electricity: {
            show: cardsInput.electricity?.show ?? current?.cards?.electricity?.show ?? def.cards.electricity.show,
            title: cardsInput.electricity?.title ?? current?.cards?.electricity?.title ?? def.cards.electricity.title,
            meterIds: elecMeterIds,
          },
          water: {
            show: cardsInput.water?.show ?? current?.cards?.water?.show ?? def.cards.water.show,
            title: cardsInput.water?.title ?? current?.cards?.water?.title ?? def.cards.water.title,
            meterIds: waterMeterIds,
          },
          fuel: {
            show: cardsInput.fuel?.show ?? current?.cards?.fuel?.show ?? def.cards.fuel.show,
            title: cardsInput.fuel?.title ?? current?.cards?.fuel?.title ?? def.cards.fuel.title,
            meterIds: fuelMeterIds,
          },
          pax: {
            show: cardsInput.pax?.show ?? current?.cards?.pax?.show ?? def.cards.pax.show,
            title: cardsInput.pax?.title ?? current?.cards?.pax?.title ?? def.cards.pax.title,
          },
          weather: {
            show: cardsInput.weather?.show ?? current?.cards?.weather?.show ?? def.cards.weather.show,
            title: cardsInput.weather?.title ?? current?.cards?.weather?.title ?? def.cards.weather.title,
          },
        },
        yearly_heatmap: {
          show: config.yearly_heatmap?.show ?? current?.yearly_heatmap?.show ?? def.yearly_heatmap.show,
          title: config.yearly_heatmap?.title ?? current?.yearly_heatmap?.title ?? def.yearly_heatmap.title,
          meter_ids: parseIds(config.yearly_heatmap?.meter_ids, current?.yearly_heatmap?.meter_ids || []),
          default_meter_id: config.yearly_heatmap?.default_meter_id ?? current?.yearly_heatmap?.default_meter_id ?? null,
        },
        trend_analysis: {
          show: config.trend_analysis?.show ?? current?.trend_analysis?.show ?? def.trend_analysis.show,
          title: config.trend_analysis?.title ?? current?.trend_analysis?.title ?? def.trend_analysis.title,
          meter_ids: parseIds(config.trend_analysis?.meter_ids, current?.trend_analysis?.meter_ids || []),
          default_energy_id: config.trend_analysis?.default_energy_id ?? current?.trend_analysis?.default_energy_id ?? 1,
          default_meter_id: config.trend_analysis?.default_meter_id ?? current?.trend_analysis?.default_meter_id ?? null,
        },
        fuel_logistics: {
          show: config.fuel_logistics?.show ?? current?.fuel_logistics?.show ?? def.fuel_logistics.show,
          title: config.fuel_logistics?.title ?? current?.fuel_logistics?.title ?? def.fuel_logistics.title,
          meter_ids: parseIds(config.fuel_logistics?.meter_ids, current?.fuel_logistics?.meter_ids || []),
          default_meter_id: config.fuel_logistics?.default_meter_id ?? current?.fuel_logistics?.default_meter_id ?? null,
        },
        yearly_spending: {
          show: config.yearly_spending?.show ?? current?.yearly_spending?.show ?? def.yearly_spending.show,
          title: config.yearly_spending?.title ?? current?.yearly_spending?.title ?? def.yearly_spending.title,
          default_energy_id: config.yearly_spending?.default_energy_id ?? current?.yearly_spending?.default_energy_id ?? 1,
        },
        pax_correlation: {
          show: config.pax_correlation?.show ?? current?.pax_correlation?.show ?? def.pax_correlation.show,
          title: config.pax_correlation?.title ?? current?.pax_correlation?.title ?? def.pax_correlation.title,
          default_energy_id: config.pax_correlation?.default_energy_id ?? current?.pax_correlation?.default_energy_id ?? 1,
        },
        electricityMeterIds: elecMeterIds,
        waterMeterIds: waterMeterIds,
        fuelMeterIds: fuelMeterIds,
      };

      writeFallbackFile(cleanConfig);

      try {
        await ensureSystemSettingsTable();
        await prisma.systemSetting.upsert({
          where: { key: SETTING_KEY },
          update: {
            value: cleanConfig as any,
            description: 'Konfigurasi Lengkap Semua Visualisasi Dashboard',
          },
          create: {
            key: SETTING_KEY,
            value: cleanConfig as any,
            description: 'Konfigurasi Lengkap Semua Visualisasi Dashboard',
          },
        });
      } catch (dbError) {
        console.warn('[DashboardConfig] Warning saving to database systemSetting:', dbError);
      }

      return cleanConfig;
    } catch (err) {
      console.error('[DashboardConfig] Error in updateCardConfig:', err);
      const def = getDefaultConfig();
      writeFallbackFile(def);
      return def;
    }
  },

  getCardConfigWithMeters: async () => {
    try {
      const [config, allMeters] = await Promise.all([
        dashboardConfigService.getCardConfig(),
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
        all: allMeters,
      };

      return {
        config,
        availableMeters: categorizedMeters,
      };
    } catch (err) {
      console.error('[DashboardConfig] Error in getCardConfigWithMeters:', err);
      return {
        config: readFallbackFile(),
        availableMeters: { electricity: [], water: [], fuel: [], all: [] },
      };
    }
  },
};
