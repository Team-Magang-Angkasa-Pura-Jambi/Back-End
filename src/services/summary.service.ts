import prisma from '../configs/db';
import type { GetSummaryQuery, SummaryResponse } from '../types/summary.type';

/**
 * Service that handles all calculation logic for the dashboard summary.
 */
export class SummaryService {
  /**
   * Private method to calculate consumption.
   * [REVISED] This logic now correctly calculates consumption for cumulative meters
   * by finding the last valid reading at the end of the period and subtracting
   * the last valid reading from before the period started.
   */
  private async _calculateConsumption(
    energyTypeName: 'Electricity' | 'Water' | 'Fuel',
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const commonWhereClause = {
      session: {
        meter: { energy_type: { type_name: energyTypeName } },
        // Always ignore sessions that have been corrected
        corrected_by: null,
      },
    };

    // Find the last valid reading at or before the END of the period
    const lastReading = await prisma.readingDetail.findFirst({
      where: {
        ...commonWhereClause,
        session: {
          ...commonWhereClause.session,
          timestamp: { lte: endDate }, // lte = less than or equal to
        },
      },
      orderBy: { session: { timestamp: 'desc' } },
    });

    // Find the last valid reading strictly BEFORE the START of the period
    const previousReading = await prisma.readingDetail.findFirst({
      where: {
        ...commonWhereClause,
        session: {
          ...commonWhereClause.session,
          timestamp: { lt: startDate }, // lt = less than
        },
      },
      orderBy: { session: { timestamp: 'desc' } },
    });

    // If there's no reading at the end, consumption is 0
    if (!lastReading) {
      return 0;
    }

    // [REVISED LOGIC] If there's no reading before the period (e.g., a new meter),
    // the consumption is the last reading value itself, assuming the baseline is 0.
    if (!previousReading) {
      // We still need to check if there is more than one reading inside the period.
      const firstReadingInPeriod = await prisma.readingDetail.findFirst({
        where: {
          ...commonWhereClause,
          session: {
            ...commonWhereClause.session,
            timestamp: { gte: startDate, lte: endDate },
          },
        },
        orderBy: { session: { timestamp: 'asc' } },
      });

      if (
        !firstReadingInPeriod ||
        firstReadingInPeriod.detail_id === lastReading.detail_id
      ) {
        const consumption = lastReading.value.toNumber();
        return consumption;
      }
      const consumption =
        lastReading.value.toNumber() - firstReadingInPeriod.value.toNumber();
      return consumption;
    }

    // Standard case: (last reading) - (previous reading)
    const consumption =
      lastReading.value.toNumber() - previousReading.value.toNumber();
    return consumption;
  }

  /**
   * Calculates the percentage change.
   */
  private _calculatePercentageChange(
    current: number,
    previous: number
  ): number | null {
    if (previous === 0) {
      return current > 0 ? 100 : 0; // Or null to indicate undefined change
    }
    return ((current - previous) / previous) * 100;
  }

  /**
   * Generates the complete summary data for the dashboard.
   */
  public async getDashboardSummary(
    query: GetSummaryQuery
  ): Promise<SummaryResponse> {
    // [REVISED] Default date range is now the current calendar month.
    const today = new Date();
    // Default start date is the first day of the current month
    const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
    // Default end date is the last day of the current month
    const defaultEndDate = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );

    const startDate = query.startDate
      ? new Date(query.startDate)
      : defaultStartDate;
    startDate.setUTCHours(0, 0, 0, 0); // Set to the start of the day

    const endDate = query.endDate ? new Date(query.endDate) : defaultEndDate;
    endDate.setUTCHours(23, 59, 59, 999); // Set to the end of the day

    // 2. Determine previous period for comparison (the full month before)
    const previousPeriodEnd = new Date(startDate.getTime() - 1); // End of the previous month
    const previousPeriodStart = new Date(
      previousPeriodEnd.getFullYear(),
      previousPeriodEnd.getMonth(),
      1
    ); // Start of the previous month
    previousPeriodStart.setUTCHours(0, 0, 0, 0);

    // 3. Fetch all consumption data in parallel for efficiency
    const [
      currentElectricity,
      previousElectricity,
      currentWater,
      previousWater,
      currentFuel,
      previousFuel,
    ] = await Promise.all([
      this._calculateConsumption('Electricity', startDate, endDate),
      this._calculateConsumption(
        'Electricity',
        previousPeriodStart,
        previousPeriodEnd
      ),
      this._calculateConsumption('Water', startDate, endDate),
      this._calculateConsumption(
        'Water',
        previousPeriodStart,
        previousPeriodEnd
      ),
      this._calculateConsumption('Fuel', startDate, endDate),
      this._calculateConsumption(
        'Fuel',
        previousPeriodStart,
        previousPeriodEnd
      ),
    ]);

    // 4. Assemble the response
    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        electricity: {
          total_consumption: currentElectricity,
          previous_period_consumption: previousElectricity,
          percentage_change: this._calculatePercentageChange(
            currentElectricity,
            previousElectricity
          ),
          unit: 'kWh',
        },
        water: {
          total_consumption: currentWater,
          previous_period_consumption: previousWater,
          percentage_change: this._calculatePercentageChange(
            currentWater,
            previousWater
          ),
          unit: 'm3',
        },
        fuel: {
          total_consumption: currentFuel,
          previous_period_consumption: previousFuel,
          percentage_change: this._calculatePercentageChange(
            currentFuel,
            previousFuel
          ),
          unit: 'Liter',
        },
      },
    };
  }
}
