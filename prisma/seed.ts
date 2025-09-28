import {
  Prisma,
  PrismaClient,
  RoleName,
  type MeterCategory,
  type ReadingType,
  type SchemeRate,
} from '../src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Tipe data spesifik untuk kejelasan dan type safety
type MeterWithEnergyType = Prisma.MeterGetPayload<{
  include: { energy_type: true };
}>;

// Helper function untuk data acak
const getRandomValue = (min: number, max: number) =>
  Math.random() * (max - min) + min;

async function main() {
  console.log('🚀 Seeding started...');

  // =============================================
  // 1. CLEANUP DATABASE (SAFE DELETE ORDER)
  // =============================================
  console.log('🧹 Cleaning up database...');
  // Urutan dari model "anak" ke "induk" untuk menghindari error foreign key.
  await prisma.priceSchemesOnTaxes.deleteMany();
  await prisma.schemeRate.deleteMany();
  await prisma.readingDetail.deleteMany();
  await prisma.summaryDetail.deleteMany();
  await prisma.dailySummary.deleteMany();
  await prisma.readingSession.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.analyticsInsight.deleteMany();
  await prisma.consumptionPrediction.deleteMany();
  await prisma.eventsLogbook.deleteMany();
  await prisma.priceScheme.deleteMany();
  await prisma.efficiencyTarget.deleteMany();
  await prisma.paxData.deleteMany();
  await prisma.tax.deleteMany();
  await prisma.user.deleteMany();
  await prisma.meter.deleteMany();
  // DIUBAH: Urutan cleanup disesuaikan dengan adanya MeterCategory
  await prisma.meterCategory.deleteMany();
  await prisma.readingType.deleteMany();
  await prisma.role.deleteMany();
  await prisma.energyType.deleteMany();

  // =============================================
  // 2. SEED CORE STATIC DATA
  // =============================================
  console.log('🌱 Seeding core static data...');
  const [roles, energyTypes, tax] = await Promise.all([
    prisma.role.createManyAndReturn({
      data: [
        { role_name: RoleName.Technician },
        { role_name: RoleName.Admin },
        { role_name: RoleName.SuperAdmin },
      ],
    }),
    prisma.energyType.createManyAndReturn({
      data: [
        { type_name: 'Electricity', unit_of_measurement: 'kWh' },
        { type_name: 'Water', unit_of_measurement: 'm³' },
        { type_name: 'Fuel', unit_of_measurement: 'Liter' },
      ],
    }),
    prisma.tax.create({ data: { tax_name: 'PPN', rate: 0.11 } }),
  ]);

  const electricityType = energyTypes.find(
    (e) => e.type_name === 'Electricity'
  )!;
  const waterType = energyTypes.find((e) => e.type_name === 'Water')!;
  const fuelType = energyTypes.find((e) => e.type_name === 'Fuel')!;

  console.log('📊 Seeding Reading Types and Meter Categories...');
  const [readingTypes, meterCategories] = await Promise.all([
    prisma.readingType.createManyAndReturn({
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
    }),
    // BARU: Membuat kategori untuk setiap jenis meter
    prisma.meterCategory.createManyAndReturn({
      data: [
        { name: 'Listrik Terminal' },
        { name: 'Listrik Perkantoran' },
        { name: 'Air Umum' },
        { name: 'BBM Genset' },
      ],
    }),
  ]);

  // Ambil semua objek yang dibutuhkan untuk relasi
  const kwhTotalType = readingTypes.find((rt) => rt.type_name === 'kWh_Total')!;
  const kwhWbpType = readingTypes.find((rt) => rt.type_name === 'WBP')!;
  const kwhLwbpType = readingTypes.find((rt) => rt.type_name === 'LWBP')!;
  const m3TotalType = readingTypes.find((rt) => rt.type_name === 'm3_Total')!;
  const literTotalType = readingTypes.find(
    (rt) => rt.type_name === 'Liter_Total'
  )!;
  const listrikTerminalCat = meterCategories.find(
    (mc) => mc.name === 'Listrik Terminal'
  )!;
  const listrikPerkantoranCat = meterCategories.find(
    (mc) => mc.name === 'Listrik Perkantoran'
  )!;
  const airUmumCat = meterCategories.find((mc) => mc.name === 'Air Umum')!;
  const bbmGensetCat = meterCategories.find((mc) => mc.name === 'BBM Genset')!;

  // BARU: Menghubungkan Kategori dengan Tipe Bacaan yang diizinkan (INTI LOGIKA)
  console.log('🔗 Linking Categories to Reading Types...');
  await Promise.all([
    // Kategori Listrik Terminal HANYA bisa WBP dan LWBP
    prisma.meterCategory.update({
      where: { category_id: listrikTerminalCat.category_id },
      data: {
        allowed_reading_types: {
          connect: [
            { reading_type_id: kwhWbpType.reading_type_id },
            { reading_type_id: kwhLwbpType.reading_type_id },
          ],
        },
      },
    }),
    // Kategori Listrik Perkantoran HANYA bisa kWh_Total
    prisma.meterCategory.update({
      where: { category_id: listrikPerkantoranCat.category_id },
      data: {
        allowed_reading_types: {
          connect: { reading_type_id: kwhTotalType.reading_type_id },
        },
      },
    }),
    // Kategori Air HANYA bisa m3_Total
    prisma.meterCategory.update({
      where: { category_id: airUmumCat.category_id },
      data: {
        allowed_reading_types: {
          connect: { reading_type_id: m3TotalType.reading_type_id },
        },
      },
    }),
    // Kategori BBM HANYA bisa Liter_Total
    prisma.meterCategory.update({
      where: { category_id: bbmGensetCat.category_id },
      data: {
        allowed_reading_types: {
          connect: { reading_type_id: literTotalType.reading_type_id },
        },
      },
    }),
  ]);

  // =============================================
  // 3. SEED USERS & METERS
  // =============================================
  console.log('👤 Seeding users and meters...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const adminRole = roles.find((r) => r.role_name === 'Admin')!;
  const techRole = roles.find((r) => r.role_name === 'Technician')!;
  const superAdminRole = roles.find((r) => r.role_name === 'SuperAdmin')!;

  const [adminUser, techUser, superAdminUser] = await Promise.all([
    prisma.user.create({
      data: {
        username: 'admin',
        password_hash: hashedPassword,
        role_id: adminRole.role_id,
      },
    }),
    prisma.user.create({
      data: {
        username: 'technician',
        password_hash: hashedPassword,
        role_id: techRole.role_id,
      },
    }),
    prisma.user.create({
      data: {
        username: 'superadmin',
        password_hash: hashedPassword,
        role_id: superAdminRole.role_id,
      },
    }),
  ]);

  // DIUBAH: Membuat meter dan langsung memasukkannya ke kategori yang benar
  const [terminalMeter1, terminalMeter2, officeMeter, waterMeter, fuelMeter] =
    await Promise.all([
      // Meter Terminal (WBP/LWBP)
      prisma.meter.create({
        data: {
          meter_code: 'ELEC-TERM-01',
          energy_type_id: electricityType.energy_type_id,
          category_id: listrikTerminalCat.category_id,
        },
        include: { energy_type: true },
      }),
      // Meter Terminal lain (WBP/LWBP)
      prisma.meter.create({
        data: {
          meter_code: 'ELEC-TERM-02',
          energy_type_id: electricityType.energy_type_id,
          category_id: listrikTerminalCat.category_id,
        },
        include: { energy_type: true },
      }),
      // Meter Perkantoran (kWh Total)
      prisma.meter.create({
        data: {
          meter_code: 'ELEC-OFFICE-01',
          energy_type_id: electricityType.energy_type_id,
          category_id: listrikPerkantoranCat.category_id,
        },
        include: { energy_type: true },
      }),
      // Meter Air
      prisma.meter.create({
        data: {
          meter_code: 'WATER-MAIN-01',
          energy_type_id: waterType.energy_type_id,
          category_id: airUmumCat.category_id,
        },
        include: { energy_type: true },
      }),
      // Meter BBM
      prisma.meter.create({
        data: {
          meter_code: 'FUEL-GENSET-01',
          energy_type_id: fuelType.energy_type_id,
          category_id: bbmGensetCat.category_id,
        },
        include: { energy_type: true },
      }),
    ]);

  // =============================================
  // 4. SEED BUSINESS LOGIC DATA (PRICE SCHEMES, etc)
  // =============================================
  console.log('💼 Seeding business logic data...');
  const [electricityPriceScheme, waterPriceScheme, fuelPriceScheme] =
    await Promise.all([
      prisma.priceScheme.create({
        data: {
          scheme_name: 'Tarif Listrik Multi-Waktu 2025',
          effective_date: new Date('2025-01-01'),
          energy_type_id: electricityType.energy_type_id,
          set_by_user_id: adminUser.user_id,
          rates: {
            create: [
              { rate_name: 'Tarif WBP', value: 2000, rate_type: 'PerUnit' },
              { rate_name: 'Tarif LWBP', value: 1450, rate_type: 'PerUnit' },
              { rate_name: 'Tarif Umum', value: 1650, rate_type: 'PerUnit' },
            ],
          },
          taxes: { create: { tax_id: tax.tax_id } },
        },
        include: { rates: true },
      }),
      prisma.priceScheme.create({
        data: {
          scheme_name: 'Tarif Air PDAM 2025',
          effective_date: new Date('2025-01-01'),
          energy_type_id: waterType.energy_type_id,
          set_by_user_id: adminUser.user_id,
          rates: {
            create: [
              { rate_name: 'Biaya per m³', value: 15000, rate_type: 'PerUnit' },
            ],
          },
        },
        include: { rates: true },
      }),
      prisma.priceScheme.create({
        data: {
          scheme_name: 'Harga Solar Industri 2025',
          effective_date: new Date('2025-01-01'),
          energy_type_id: fuelType.energy_type_id,
          set_by_user_id: adminUser.user_id,
          rates: {
            create: [
              {
                rate_name: 'Biaya per Liter',
                value: 16500,
                rate_type: 'PerUnit',
              },
            ],
          },
        },
        include: { rates: true },
      }),
    ]);

  // Ekstrak tarif spesifik
  const wbpRate = electricityPriceScheme.rates.find(
    (r) => r.rate_name === 'Tarif WBP'
  )!;
  const lwbpRate = electricityPriceScheme.rates.find(
    (r) => r.rate_name === 'Tarif LWBP'
  )!;
  const generalRate = electricityPriceScheme.rates.find(
    (r) => r.rate_name === 'Tarif Umum'
  )!;

  // =============================================
  // 5. SEED TIME-SERIES & DERIVED DATA
  // =============================================
  console.log('📈 Seeding time-series data for all meters...');
  await Promise.all([
    // Gunakan fungsi WBP/LWBP untuk kedua meter terminal
    seedElectricityTimeSeriesData(
      terminalMeter1,
      { wbp: kwhWbpType, lwbp: kwhLwbpType },
      { wbp: wbpRate, lwbp: lwbpRate },
      techUser.user_id
    ),
    seedElectricityTimeSeriesData(
      terminalMeter2,
      { wbp: kwhWbpType, lwbp: kwhLwbpType },
      { wbp: wbpRate, lwbp: lwbpRate },
      techUser.user_id
    ),
    // Gunakan fungsi Sederhana untuk meter perkantoran
    seedSimpleTimeSeriesData(
      officeMeter,
      kwhTotalType,
      50000,
      [150, 250],
      generalRate,
      techUser.user_id
    ),
    // Gunakan fungsi Sederhana untuk Air dan BBM
    seedSimpleTimeSeriesData(
      waterMeter,
      m3TotalType,
      2000,
      [5, 15],
      waterPriceScheme.rates[0],
      techUser.user_id
    ),
    seedSimpleTimeSeriesData(
      fuelMeter,
      literTotalType,
      5000,
      [20, 70],
      fuelPriceScheme.rates[0],
      techUser.user_id
    ),
  ]);

  console.log('✅ Seeding finished successfully!');
}

/**
 * Seeder khusus untuk data listrik Terminal (WBP & LWBP).
 */
async function seedElectricityTimeSeriesData(
  meter: MeterWithEnergyType,
  readingTypes: { wbp: ReadingType; lwbp: ReadingType },
  rates: { wbp: SchemeRate; lwbp: SchemeRate },
  technicianId: number
) {
  let prevWbpReading = getRandomValue(40000, 50000);
  let prevLwbpReading = getRandomValue(60000, 70000);

  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setUTCHours(0, 0, 0, 0);

    const totalDailyConsumption = getRandomValue(250, 450);
    const wbpPercentage = getRandomValue(0.2, 0.4);
    const wbpConsumption = totalDailyConsumption * wbpPercentage;
    const lwbpConsumption = totalDailyConsumption * (1 - wbpPercentage);

    const currentWbpReading = prevWbpReading + wbpConsumption;
    const currentLwbpReading = prevLwbpReading + lwbpConsumption;

    const wbpCost = wbpConsumption * parseFloat(rates.wbp.value.toString());
    const lwbpCost = lwbpConsumption * parseFloat(rates.lwbp.value.toString());
    const totalCost = wbpCost + lwbpCost;

    await prisma.readingSession.create({
      data: {
        reading_date: date,
        meter_id: meter.meter_id,
        user_id: technicianId,
        details: {
          create: [
            {
              reading_type_id: readingTypes.wbp.reading_type_id,
              value: currentWbpReading,
            },
            {
              reading_type_id: readingTypes.lwbp.reading_type_id,
              value: currentLwbpReading,
            },
          ],
        },
      },
    });

    await prisma.dailySummary.create({
      data: {
        summary_date: date,
        meter_id: meter.meter_id,
        total_cost: totalCost,
        details: {
          create: [
            {
              energy_type_id: meter.energy_type_id,
              metric_name: 'Pemakaian WBP (kWh)',
              consumption_value: wbpConsumption,
              current_reading: currentWbpReading,
              previous_reading: prevWbpReading,
              consumption_cost: wbpCost,
            },
            {
              energy_type_id: meter.energy_type_id,
              metric_name: 'Pemakaian LWBP (kWh)',
              consumption_value: lwbpConsumption,
              current_reading: currentLwbpReading,
              previous_reading: prevLwbpReading,
              consumption_cost: lwbpCost,
            },
          ],
        },
      },
    });

    prevWbpReading = currentWbpReading;
    prevLwbpReading = currentLwbpReading;
  }
}

/**
 * Seeder untuk data time-series sederhana (Perkantoran, Air, BBM).
 */
async function seedSimpleTimeSeriesData(
  meter: MeterWithEnergyType,
  readingType: ReadingType,
  initialValue: number,
  dailyConsumptionRange: [number, number],
  rate: SchemeRate,
  technicianId: number
) {
  let previousReading = initialValue;

  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setUTCHours(0, 0, 0, 0);

    const dailyConsumption = getRandomValue(
      dailyConsumptionRange[0],
      dailyConsumptionRange[1]
    );
    const currentReading = previousReading + dailyConsumption;
    const cost = dailyConsumption * parseFloat(rate.value.toString());

    await prisma.readingSession.create({
      data: {
        reading_date: date,
        meter_id: meter.meter_id,
        user_id: technicianId,
        details: {
          create: {
            reading_type_id: readingType.reading_type_id,
            value: currentReading,
          },
        },
      },
    });

    await prisma.dailySummary.create({
      data: {
        summary_date: date,
        meter_id: meter.meter_id,
        total_cost: cost,
        details: {
          create: {
            energy_type_id: meter.energy_type_id,
            metric_name: `Pemakaian Harian (${meter.energy_type.unit_of_measurement})`,
            consumption_value: dailyConsumption,
            current_reading: currentReading,
            previous_reading: previousReading,
            consumption_cost: cost,
          },
        },
      },
    });

    previousReading = currentReading;
  }
}

main()
  .catch((e) => {
    console.error('❌ An error occurred during seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
