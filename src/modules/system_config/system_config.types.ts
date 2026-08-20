export interface EnvEndpointsConfig {
  backend_api_url: string;
  ml_api_base_url: string;
}

export interface ApiEndpointConfig {
  active_environment: 'development' | 'production';
  development: EnvEndpointsConfig;
  production: EnvEndpointsConfig;
  backend_api_url?: string;
  ml_api_base_url?: string;
}

export interface SecurityTokenConfig {
  jwt_secret: string;
  uploadthing_app_id?: string;
  uploadthing_secret?: string;
  uploadthing_token?: string;
}

export interface WeatherLocationConfig {
  airport_name: string;
  latitude: number;
  longitude: number;
  openweather_api_key: string;
}

export interface DashboardCardMetersConfig {
  electricityMeterIds: number[];
  waterMeterIds: number[];
  fuelMeterIds: number[];
}

export interface FullSystemConfigPayload {
  endpoints: ApiEndpointConfig;
  security: SecurityTokenConfig;
  weather: WeatherLocationConfig;
  dashboardCards: DashboardCardMetersConfig;
}

export interface SystemConfigResponse {
  config: FullSystemConfigPayload;
  availableMeters: {
    electricity: any[];
    water: any[];
    fuel: any[];
  };
  server_info: {
    node_env: string;
    port: number;
    uptime_seconds: number;
  };
}

export interface MasterPackageExportData {
  version: string;
  exported_at: string;
  environment: string;
  exported_by?: {
    user_id?: number;
    username?: string;
  };
  counts: Record<string, number>;
  data: {
    energies: any[];
    reading_types: any[];
    locations: any[];
    tenants: any[];
    price_schemes: any[];
    calculation_templates: any[];
    meters: any[];
    efficiency_targets: any[];
    annual_budgets: any[];
  };
}
