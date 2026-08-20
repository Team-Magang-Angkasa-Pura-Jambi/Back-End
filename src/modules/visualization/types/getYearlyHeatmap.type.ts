export type UsageCategory =
  | 'SANGAT_EFISIEN'
  | 'NORMAL'
  | 'MENDEKATI_LIMIT'
  | 'OVER_BUDGET'
  | 'UNKNOWN';

  export interface HeatmapDay {
    id: string;
    dateDisplay: string;
    status: UsageCategory;
    confidence: string | null;
    color: string;
  }

export interface HeatmapMonthGroup {
  monthName: string;
  offset: number;
  days: HeatmapDay[];
}

export interface YearlyHeatmapResult {
  groupedData: HeatmapMonthGroup[];
  statsSummary: Record<Exclude<UsageCategory, 'UNKNOWN'>, number>;
  totalDays: number;
}
    