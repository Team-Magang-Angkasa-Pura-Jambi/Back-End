// Generated for Sentinel Project

import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { type EfficiencyTargetPayload } from './efficiency_targets.type.js';

export const efficiencyTargetsService = {
  show: async (id?: number, query?: { priode_start: Date; priode_end: Date; kpi_Name: string }) => {
    if (id) {
      return await prisma.efficiencyTarget.findUnique({
        where: {
          target_id: id,
        },
        include: { meter: { select: { meter_id: true, meter_code: true, name: true } } },
      });
    }

    const where: Prisma.EfficiencyTargetWhereInput = {};

    if (query?.priode_start) {
      where.period_start = { gte: query.priode_start };
    }

    if (query?.priode_end) {
      where.period_end = { lte: query.priode_end };
    }

    if (query?.kpi_Name) {
      where.kpi_name = { contains: query.kpi_Name };
    }

    return await prisma.efficiencyTarget.findMany({
      where,
      include: { meter: { select: { meter_id: true, meter_code: true, name: true } } },
    });
  },

  store: async (data: EfficiencyTargetPayload) => {
    try {
      return await prisma.efficiencyTarget.create({ data });
    } catch (error) {
      return handlePrismaError(error, 'Efficiency Target');
    }
  },

  patch: async (id: number, data: EfficiencyTargetPayload) => {
    try {
      return await prisma.efficiencyTarget.update({
        where: { target_id: id },
        data,
      });
    } catch (error) {
      return handlePrismaError(error, 'Efficiency Target');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.efficiencyTarget.delete({
        where: { target_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Efficiency Target');
    }
  },

  previewEfficiency: async (data: {
    meter_id: number;
    target_percentage: number; // dlm decimal, misal 0.05
  }) => {
    // 1. Ambil Alokasi Budget terbaru untuk Meter ini
    const allocation = await prisma.budgetAllocation.findFirst({
      where: { meter_id: data.meter_id },
      include: {
        budget: { include: { energy_type: true } },
        meter: { include: { price_scheme: { include: { rates: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });

    // 2. Guard Clause: Jika alokasi belum ada
    if (!allocation) {
      return {
        can_preview: false,
        message:
          'Pratinjau tidak tersedia. Alokasi budget belum ditetapkan oleh sistem untuk perangkat ini, sehingga perhitungan baseline otomatis tidak dapat dilakukan.',
      };
    }

    // 3. Ambil Harga per Unit dari PriceScheme yang aktif di Meter tersebut
    // Kita ambil rate pertama (atau sesuaikan logic jika ada WBP/LWBP, bisa diambil rata-ratanya)
    const activeRate = allocation.meter.price_scheme?.rates[0]?.rate_value;

    if (!activeRate) {
      return {
        can_preview: false,
        message:
          'Skema harga aktif tidak ditemukan. Pastikan meteran telah terhubung dengan skema harga yang valid.',
      };
    }

    const budgetAmount = Number(allocation.allocated_amount);
    const ratePerUnit = Number(activeRate);
    const percentage = data.target_percentage;

    // 4. Kalkulasi Konversi
    // Baseline Volume = Total Budget (Rp) / Harga per Unit (Rp/kWh atau Rp/m3)
    const estimatedBaseline = budgetAmount / ratePerUnit;
    const volumeReduction = estimatedBaseline * percentage;
    const consumptionLimit = estimatedBaseline - volumeReduction;
    const moneySavings = volumeReduction * ratePerUnit;

    return {
      can_preview: true,
      data: {
        allocated_budget: budgetAmount,
        price_per_unit: ratePerUnit,
        estimated_baseline_volume: estimatedBaseline,
        target_volume_reduction: volumeReduction,
        new_consumption_limit: consumptionLimit,
        potential_savings_amount: moneySavings,
      },
    };
  },
};
