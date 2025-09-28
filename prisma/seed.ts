import { PrismaClient } from '../src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding started...');

  // --- Hapus data lama (dalam urutan yang benar untuk menghindari error relasi) ---
  await prisma.readingDetail.deleteMany();
  await prisma.summaryDetail.deleteMany();
  await prisma.dailySummary.deleteMany();
  await prisma.readingSession.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.efficiencyTarget.deleteMany();
  await prisma.schemeRate.deleteMany();
  await prisma.priceScheme.deleteMany();
  await prisma.analyticsInsight.deleteMany();
  await prisma.consumptionPrediction.deleteMany();
  await prisma.eventsLogbook.deleteMany();
  await prisma.paxData.deleteMany();
  await prisma.user.deleteMany();
  await prisma.meter.deleteMany();
  await prisma.readingType.deleteMany();
  await prisma.role.deleteMany();
  await prisma.energyType.deleteMany();

  // =============================================
  // SEED DATA DASAR (TANPA RELASI)
  // =============================================
  console.log('Seeding Roles...');
  const roles = await prisma.role.createManyAndReturn({
    data: [
      { role_name: 'Technician' },
      { role_name: 'Admin' },
      { role_name: 'SuperAdmin' },
    ],
  });

  console.log('Seeding Energy Types...');
  const energyTypes = await prisma.energyType.createManyAndReturn({
    data: [
      { type_name: 'Electricity', unit_of_measurement: 'kWh' },
      { type_name: 'Water', unit_of_measurement: 'm³' },
      { type_name: 'Fuel', unit_of_measurement: 'Liter' },
    ],
  });
  const electricityType = energyTypes.find(
    (e) => e.type_name === 'Electricity'
  )!;
  const waterType = energyTypes.find((e) => e.type_name === 'Water')!;
  const fuelType = energyTypes.find((e) => e.type_name === 'Fuel')!;

  console.log('Seeding Reading Types...');
  await prisma.readingType.createMany({
    data: [
      {
        type_name: 'kWh_Total',
        energy_type_id: electricityType.energy_type_id,
      },
      { type_name: 'WBP', energy_type_id: electricityType.energy_type_id },
      { type_name: 'LWBP', energy_type_id: electricityType.energy_type_id },
      { type_name: 'm3_Total', energy_type_id: waterType.energy_type_id },
      { type_name: 'Liter_Total', energy_type_id: fuelType.energy_type_id },
    ],
  });
  const kwhTotalType = await prisma.readingType.findUniqueOrThrow({
    where: { type_name: 'kWh_Total' },
    include: {
      energy_type: true, // Ini akan memuat data dari relasi EnergyType
    },
  });
  const m3TotalType = await prisma.readingType.findUniqueOrThrow({
    where: { type_name: 'm3_Total' },
    include: {
      energy_type: true, // Ini akan memuat data dari relasi EnergyType
    },
  });
  const literTotalType = await prisma.readingType.findUniqueOrThrow({
    where: { type_name: 'Liter_Total' },
    include: {
      energy_type: true, // Ini akan memuat data dari relasi EnergyType
    },
  });

  // =============================================
  // SEED USERS & METERS
  // =============================================
  console.log('Seeding Users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const adminRole = roles.find((r) => r.role_name === 'Admin')!;
  const superadminRole = roles.find((r) => r.role_name === 'SuperAdmin')!;
  const technicianRole = roles.find((r) => r.role_name === 'Technician')!;

  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      password_hash: hashedPassword,
      role_id: adminRole.role_id,
    },
  });
  const techUser = await prisma.user.create({
    data: {
      username: 'technician',
      password_hash: hashedPassword,
      role_id: technicianRole.role_id,
    },
  });
  const superAdmin = await prisma.user.create({
    data: {
      username: 'superadmin',
      password_hash: hashedPassword,
      role_id: adminRole.role_id,
    },
  });

  console.log('Seeding Meters...');
  const electricityMeter = await prisma.meter.create({
    data: {
      meter_code: 'ELEC-001',
      location: 'Gedung Utama',
      energy_type_id: electricityType.energy_type_id,
    },
  });
  const waterMeter = await prisma.meter.create({
    data: {
      meter_code: 'WATER-001',
      location: 'Area Taman',
      energy_type_id: waterType.energy_type_id,
    },
  });
  const fuelMeter = await prisma.meter.create({
    data: {
      meter_code: 'FUEL-GENSET-01',
      location: 'Genset Area',
      energy_type_id: fuelType.energy_type_id,
    },
  });

  // =============================================
  // SEED BUSINESS LOGIC DATA
  // =============================================
  console.log('Seeding Business Logic Data...');
  await prisma.paxData.create({
    data: { data_date: new Date(), total_pax: 150 },
  });

  const target = await prisma.efficiencyTarget.create({
    data: {
      kpi_name: 'Penghematan Listrik Bulanan',
      target_value: 150000,
      period_start: new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      ),
      period_end: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      ),
      energy_type_id: electricityType.energy_type_id,
      set_by_user_id: adminUser.user_id,
    },
  });

  await prisma.priceScheme.create({
    data: {
      scheme_name: 'Tarif Listrik Dasar 2025',
      effective_date: new Date('2025-01-01'),
      energy_type_id: electricityType.energy_type_id,
      set_by_user_id: adminUser.user_id,
      rates: {
        create: [
          { rate_name: 'Biaya per kWh', value: 1500, rate_type: 'PerUnit' },
        ],
      },
    },
  });

  await prisma.alert.create({
    data: {
      actual_value: 5100,
      target_value_at_trigger: 5000,
      status: 'NEW',
      target_id: target.target_id,
    },
  });

  // =============================================
  // SEED TIME-SERIES DATA (READINGS & SUMMARIES)
  // =============================================
  const seedTimeSeriesData = async (
    meter: any,
    readingType: any,
    initialValue: number,
    dailyConsumptionRange: [number, number],
    costPerUnit: number
  ) => {
    console.log(`Seeding 10 days of data for ${meter.meter_code}...`);
    let currentValue = initialValue;

    for (let i = 10; i > 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setUTCHours(0, 0, 0, 0);

      const previousDate = new Date(date);
      previousDate.setDate(previousDate.getDate() - 1);

      const previousDetail = await prisma.summaryDetail.findFirst({
        where: {
          summary: { summary_date: previousDate, meter_id: meter.meter_id },
          metric_name: { contains: 'Pemakaian Harian' },
        },
        orderBy: { detail_id: 'desc' },
      });
      const previousReading =
        previousDetail?.current_reading ??
        currentValue -
          (Math.random() *
            (dailyConsumptionRange[1] - dailyConsumptionRange[0]) +
            dailyConsumptionRange[0]);

      const dailyConsumption =
        Math.random() * (dailyConsumptionRange[1] - dailyConsumptionRange[0]) +
        dailyConsumptionRange[0];
      currentValue = parseFloat(previousReading.toString()) + dailyConsumption;

      const session = await prisma.readingSession.create({
        data: {
          reading_date: date,
          meter_id: meter.meter_id,
          user_id: techUser.user_id,
        },
      });

      await prisma.readingDetail.create({
        data: {
          session_id: session.session_id,
          reading_type_id: readingType.reading_type_id,
          value: currentValue,
        },
      });

      const cost = dailyConsumption * costPerUnit;
      const summary = await prisma.dailySummary.upsert({
        where: {
          summary_date_meter_id: {
            summary_date: date,
            meter_id: meter.meter_id,
          },
        },
        update: { total_cost: cost },
        create: {
          summary_date: date,
          meter_id: meter.meter_id,
          total_cost: cost,
        },
      });

      await prisma.summaryDetail.deleteMany({
        where: { summary_id: summary.summary_id },
      });
      await prisma.summaryDetail.createMany({
        data: [
          {
            summary_id: summary.summary_id,
            energy_type_id: meter.energy_type_id,
            metric_name: `Pemakaian Harian (${readingType.energy_type.unit_of_measurement})`,
            consumption_value: dailyConsumption,
            current_reading: currentValue,
            previous_reading: previousReading,
            consumption_cost: cost,
          },
          {
            summary_id: summary.summary_id,
            energy_type_id: meter.energy_type_id,
            metric_name: `Biaya Harian (IDR)`,
            consumption_value: cost,
            current_reading: 0,
            previous_reading: 0,
            consumption_cost: cost,
          },
        ],
      });
    }
  };

  await seedTimeSeriesData(
    electricityMeter,
    kwhTotalType,
    10000,
    [50, 150],
    1500
  );
  await seedTimeSeriesData(waterMeter, m3TotalType, 2000, [5, 15], 15000);
  await seedTimeSeriesData(fuelMeter, literTotalType, 5000, [20, 70], 16500);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
