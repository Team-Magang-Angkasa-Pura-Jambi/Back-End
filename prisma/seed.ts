import {
  PrismaClient,
  Prisma,
  RoleName,
  UsageCategory,
} from '../src/generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// =============================================
// KONFIGURASI SEEDER
// =============================================
const DAYS_TO_GENERATE = 30; // Jumlah hari ke belakang untuk generate data
const STARTING_WBP = 50000; // Nilai awal untuk WBP
const STARTING_LWBP = 80000; // Nilai awal untuk LWBP
const STARTING_WATER = 15000; // Nilai awal untuk Air
const STARTING_FUEL_HEIGHT = 180; // Ketinggian awal BBM (cm)

// =============================================
// REPLIKASI KONSTANTA & LOGIKA DARI READING.SERVICE
// =============================================

const DEFAULT_PRICES = {
  ELECTRICITY_WBP: new Prisma.Decimal(1700),
  ELECTRICITY_LWBP: new Prisma.Decimal(1450),
  ELECTRICITY_GENERAL: new Prisma.Decimal(1650),
  WATER: new Prisma.Decimal(15000),
  FUEL: new Prisma.Decimal(16500),
};

const TANK_HEIGHT_CM = new Prisma.Decimal(200);
const TANK_VOLUME_LITERS = new Prisma.Decimal(5000);
const LITERS_PER_CM = TANK_VOLUME_LITERS.div(TANK_HEIGHT_CM);

// Helper untuk mendapatkan nilai acak
const getRandomIncrement = (min: number, max: number) =>
  Math.random() * (max - min) + min;

/**
 * Normalisasi tanggal ke UTC tengah malam untuk konsistensi DB.
 */
function normalizeDate(date: Date): Date {
  const localDate = new Date(date);
  const year = localDate.getFullYear();
  const month = localDate.getMonth();
  const day = localDate.getDate();
  return new Date(Date.UTC(year, month, day));
}

/**
 * Menghitung konsumsi dengan aman, menangani reset meter.
 */
function calculateSafeConsumption(
  currentValue?: Prisma.Decimal | number | null,
  previousValue?: Prisma.Decimal | number | null
): Prisma.Decimal {
  const current = new Prisma.Decimal(currentValue ?? 0);
  const previous = new Prisma.Decimal(previousValue ?? 0);
  if (current.lessThan(previous)) {
    return new Prisma.Decimal(0);
  }
  return current.minus(previous);
}

/**
 * Mencari skema harga yang aktif pada tanggal tertentu.
 */
async function getLatestPriceScheme(
  tx: Prisma.TransactionClient,
  tariffGroupId: number,
  date: Date
) {
  return tx.priceScheme.findFirst({
    where: {
      tariff_group_id: tariffGroupId,
      effective_date: { lte: date },
      is_active: true,
    },
    orderBy: { effective_date: 'desc' },
    include: { rates: true },
  });
}

/**
 * Replikasi logika kalkulasi dan pembuatan DailySummary & SummaryDetail.
 */
async function createOrUpdateDailySummary(
  tx: Prisma.TransactionClient,
  meterId: number,
  dateForDb: Date
) {
  const meter = await tx.meter.findUniqueOrThrow({
    where: { meter_id: meterId },
    include: { energy_type: true, category: true, tariff_group: true },
  });

  const currentSession = await tx.readingSession.findUnique({
    where: {
      unique_meter_reading_per_day: {
        reading_date: dateForDb,
        meter_id: meterId,
      },
    },
    include: { details: { include: { reading_type: true } } },
  });

  if (!currentSession) return;

  const previousSession = await tx.readingSession.findFirst({
    where: { meter_id: meterId, reading_date: { lt: dateForDb } },
    orderBy: { reading_date: 'desc' },
    include: { details: { include: { reading_type: true } } },
  });

  const priceScheme = await getLatestPriceScheme(
    tx,
    meter.tariff_group_id,
    dateForDb
  );

  let summaryDetailsToCreate: Omit<
    Prisma.SummaryDetailCreateManyInput,
    'summary_id'
  >[] = [];
  const getDetailValue = (
    session: typeof currentSession | typeof previousSession,
    typeName: string
  ) =>
    session?.details.find((d) => d.reading_type.type_name === typeName)?.value;

  if (meter.energy_type.type_name === 'Electricity') {
    const wbpConsumption = calculateSafeConsumption(
      getDetailValue(currentSession, 'WBP'),
      getDetailValue(previousSession, 'WBP')
    );
    const lwbpConsumption = calculateSafeConsumption(
      getDetailValue(currentSession, 'LWBP'),
      getDetailValue(previousSession, 'LWBP')
    );
    const wbpType = currentSession.details.find(
      (d) => d.reading_type.type_name === 'WBP'
    )?.reading_type;
    const lwbpType = currentSession.details.find(
      (d) => d.reading_type.type_name === 'LWBP'
    )?.reading_type;
    const HARGA_WBP = new Prisma.Decimal(
      priceScheme?.rates.find(
        (r) => r.reading_type_id === wbpType?.reading_type_id
      )?.value ?? DEFAULT_PRICES.ELECTRICITY_WBP
    );
    const HARGA_LWBP = new Prisma.Decimal(
      priceScheme?.rates.find(
        (r) => r.reading_type_id === lwbpType?.reading_type_id
      )?.value ?? DEFAULT_PRICES.ELECTRICITY_LWBP
    );

    summaryDetailsToCreate.push(
      {
        metric_name: 'Pemakaian WBP',
        energy_type_id: meter.energy_type_id,
        current_reading: getDetailValue(currentSession, 'WBP') ?? 0,
        previous_reading: getDetailValue(previousSession, 'WBP') ?? 0,
        consumption_value: wbpConsumption,
        consumption_cost: wbpConsumption.times(HARGA_WBP),
        wbp_value: wbpConsumption,
      },
      {
        metric_name: 'Pemakaian LWBP',
        energy_type_id: meter.energy_type_id,
        current_reading: getDetailValue(currentSession, 'LWBP') ?? 0,
        previous_reading: getDetailValue(previousSession, 'LWBP') ?? 0,
        consumption_value: lwbpConsumption,
        consumption_cost: lwbpConsumption.times(HARGA_LWBP),
        lwbp_value: lwbpConsumption,
      }
    );
  } else if (meter.energy_type.type_name === 'Water') {
    const consumption = calculateSafeConsumption(
      getDetailValue(currentSession, 'Flow'),
      getDetailValue(previousSession, 'Flow')
    );
    const flowType = currentSession.details.find(
      (d) => d.reading_type.type_name === 'Flow'
    )?.reading_type;
    const HARGA_AIR = new Prisma.Decimal(
      priceScheme?.rates.find(
        (r) => r.reading_type_id === flowType?.reading_type_id
      )?.value ?? DEFAULT_PRICES.WATER
    );
    summaryDetailsToCreate.push({
      metric_name: `Pemakaian Harian (m³)`,
      energy_type_id: meter.energy_type_id,
      current_reading: getDetailValue(currentSession, 'Flow') ?? 0,
      previous_reading: getDetailValue(previousSession, 'Flow') ?? 0,
      consumption_value: consumption,
      consumption_cost: consumption.times(HARGA_AIR),
    });
  } else if (meter.energy_type.type_name === 'Fuel') {
    const currentHeight = new Prisma.Decimal(
      getDetailValue(currentSession, 'Fuel Level') ?? 0
    );
    const previousHeight = new Prisma.Decimal(
      getDetailValue(previousSession, 'Fuel Level') ?? 0
    );
    const heightDifference = previousHeight.minus(currentHeight);
    const consumptionInLiters = heightDifference.isNegative()
      ? new Prisma.Decimal(0)
      : heightDifference.times(LITERS_PER_CM);
    const fuelType = currentSession.details.find(
      (d) => d.reading_type.type_name === 'Fuel Level'
    )?.reading_type;
    const HARGA_BBM = new Prisma.Decimal(
      priceScheme?.rates.find(
        (r) => r.reading_type_id === fuelType?.reading_type_id
      )?.value ?? DEFAULT_PRICES.FUEL
    );
    summaryDetailsToCreate.push({
      metric_name: `Pemakaian Harian (Liter)`,
      energy_type_id: meter.energy_type_id,
      current_reading: currentHeight,
      previous_reading: previousHeight,
      consumption_value: consumptionInLiters,
      consumption_cost: consumptionInLiters.times(HARGA_BBM),
    });
  }

  const totalCost = summaryDetailsToCreate.reduce(
    (sum, detail) => sum.plus(detail.consumption_cost),
    new Prisma.Decimal(0)
  );

  const dailySummary = await tx.dailySummary.upsert({
    where: {
      summary_date_meter_id: { summary_date: dateForDb, meter_id: meterId },
    },
    update: { total_cost: totalCost },
    create: {
      summary_date: dateForDb,
      meter_id: meterId,
      total_cost: totalCost,
    },
  });

  await tx.summaryDetail.deleteMany({
    where: { summary_id: dailySummary.summary_id },
  });
  await tx.summaryDetail.createMany({
    data: summaryDetailsToCreate.map((detail) => ({
      ...detail,
      summary_id: dailySummary.summary_id,
    })),
  });

  const classifications = [
    UsageCategory.HEMAT,
    UsageCategory.NORMAL,
    UsageCategory.BOROS,
  ];
  const randomClassification =
    classifications[Math.floor(Math.random() * classifications.length)];
  await tx.dailyUsageClassification.upsert({
    where: { summary_id: dailySummary.summary_id },
    update: { classification: randomClassification },
    create: {
      summary_id: dailySummary.summary_id,
      meter_id: meter.meter_id,
      classification_date: dailySummary.summary_date,
      classification: randomClassification,
      model_version: '1.1.0-dummy',
      confidence_score: getRandomIncrement(0.85, 0.98),
      reasoning:
        'Klasifikasi berdasarkan aturan dummy untuk seeding data historis.',
    },
  });
}

/**
 * FUNGSI UTAMA SEEDER
 */
async function main() {
  console.log('🚀 Starting complete database seeding...');

  // LANGKAH 1: BERSIHKAN DATABASE (Hanya data transaksional dan yang terkait)
  console.log('🧹 Cleaning up previous transactional and related data...');
  await prisma.$transaction([
    prisma.dailyUsageClassification.deleteMany({}),
    prisma.summaryDetail.deleteMany({}),
    prisma.dailySummary.deleteMany({}),
    prisma.readingDetail.deleteMany({}),
    prisma.readingSession.deleteMany({}),
    // Hapus juga data master yang akan dibuat ulang untuk memastikan kebersihan
    prisma.schemeRate.deleteMany({}),
    prisma.priceSchemesOnTaxes.deleteMany({}),
    prisma.priceScheme.deleteMany({}),
    prisma.user.deleteMany({}),
    prisma.meter.deleteMany({}),
    prisma.meterCategory.deleteMany({}),
    prisma.readingType.deleteMany({}),
    prisma.role.deleteMany({}),
    prisma.energyType.deleteMany({}),
    prisma.tax.deleteMany({}),
    prisma.tariffGroup.deleteMany({}),
  ]);
  console.log('✅ Previous data cleaned.');

  // LANGKAH 2: BUAT SEMUA DATA MASTER
  console.log('🛠️ Creating master data...');

  const roles = await prisma.role.createManyAndReturn({
    data: [
      { role_name: RoleName.Technician },
      { role_name: RoleName.Admin },
      { role_name: RoleName.SuperAdmin },
    ],
  });
  const adminRole = roles.find((r) => r.role_name === 'Admin')!;
  const techRole = roles.find((r) => r.role_name === 'Technician')!;
  const superAdminRole = roles.find((r) => r.role_name === 'SuperAdmin')!;

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

  const wbpType = await prisma.readingType.create({
    data: {
      type_name: 'WBP',
      reading_unit: 'kWh',
      energy_type_id: electricityType.energy_type_id,
    },
  });
  const lwbpType = await prisma.readingType.create({
    data: {
      type_name: 'LWBP',
      reading_unit: 'kWh',
      energy_type_id: electricityType.energy_type_id,
    },
  });
  const flowType = await prisma.readingType.create({
    data: {
      type_name: 'Flow',
      reading_unit: 'm³',
      energy_type_id: waterType.energy_type_id,
    },
  });
  const fuelLevelType = await prisma.readingType.create({
    data: {
      type_name: 'Fuel Level',
      reading_unit: 'cm',
      energy_type_id: fuelType.energy_type_id,
    },
  });

  const tariffGroups = await prisma.tariffGroup.createManyAndReturn({
    data: [
      { group_code: 'B2/TR', group_name: 'Bisnis Tegangan Rendah' },
      { group_code: 'B3/TM', group_name: 'Bisnis Tegangan Menengah' },
    ],
  });
  const tariffB2 = tariffGroups.find((t) => t.group_code === 'B2/TR')!;
  const tariffB3 = tariffGroups.find((t) => t.group_code === 'B3/TM')!;

  const categories = await prisma.meterCategory.createManyAndReturn({
    data: [
      { name: 'Listrik Terminal' },
      { name: 'Listrik Perkantoran' },
      { name: 'Air Utama' },
      { name: 'Fuel Genset' },
    ],
  });
  const catTerminal = categories.find((c) => c.name === 'Listrik Terminal')!;
  const catWater = categories.find((c) => c.name === 'Air Utama')!;
  const catFuel = categories.find((c) => c.name === 'Fuel Genset')!;

  // LANGKAH 3: BUAT HASH PASSWORD
  const password = await bcrypt.hash('password123', 10);

  // LANGKAH 4: BUAT DATA PENGGUNA
  const users = await prisma.user.createManyAndReturn({
    data: [
      {
        username: 'admin',
        password_hash: password,
        role_id: adminRole.role_id,
      },
      {
        username: 'technician',
        password_hash: password,
        role_id: techRole.role_id,
      },
      {
        username: 'superadmin',
        password_hash: password,
        role_id: superAdminRole.role_id,
      },
    ],
  });
  const technician = users.find((u) => u.username === 'technician')!;
  const superAdminUser = users.find((u) => u.username === 'superadmin')!;

  // LANGKAH 5: BUAT DATA METER & SKEMA HARGA
  const elecMeter = await prisma.meter.create({
    data: {
      meter_code: 'ELEC-TERM-01',
      energy_type_id: electricityType.energy_type_id,
      category_id: catTerminal.category_id,
      tariff_group_id: tariffB3.tariff_group_id,
    },
  });
  const waterMeter = await prisma.meter.create({
    data: {
      meter_code: 'WATER-MAIN-01',
      energy_type_id: waterType.energy_type_id,
      category_id: catWater.category_id,
      tariff_group_id: tariffB2.tariff_group_id,
    },
  });
  const fuelMeter = await prisma.meter.create({
    data: {
      meter_code: 'FUEL-GENSET-01',
      energy_type_id: fuelType.energy_type_id,
      category_id: catFuel.category_id,
      tariff_group_id: tariffB2.tariff_group_id,
    },
  });

  await prisma.priceScheme.create({
    data: {
      scheme_name: 'Tarif Dasar 2024',
      effective_date: new Date('2024-01-01T00:00:00.000Z'),
      tariff_group_id: tariffB3.tariff_group_id,
      set_by_user_id: superAdminUser.user_id,
      rates: {
        create: [
          { reading_type_id: wbpType.reading_type_id, value: 1700 },
          { reading_type_id: lwbpType.reading_type_id, value: 1450 },
        ],
      },
    },
  });
  console.log('✅ Master data created.');

  // LANGKAH 6: MULAI SEEDING DATA HISTORIS
  console.log('🔄 Starting historical data generation...');
  let lastReadings = {
    [elecMeter.meter_id]: { wbp: STARTING_WBP, lwbp: STARTING_LWBP },
    [waterMeter.meter_id]: { flow: STARTING_WATER },
    [fuelMeter.meter_id]: { level: STARTING_FUEL_HEIGHT },
  };

  // 3. Loop untuk setiap hari ke belakang
  for (let i = DAYS_TO_GENERATE; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateForDb = normalizeDate(date);

    console.log(
      `\n🔄 Generating data for ${dateForDb.toISOString().split('T')[0]}...`
    );

    // --- Generate data untuk Meter Listrik ---
    const wbpIncrement = getRandomIncrement(50, 150);
    const lwbpIncrement = getRandomIncrement(100, 300);
    lastReadings[elecMeter.meter_id].wbp += wbpIncrement;
    lastReadings[elecMeter.meter_id].lwbp += lwbpIncrement;

    await prisma.$transaction(async (tx) => {
      await tx.readingSession.create({
        data: {
          meter_id: elecMeter.meter_id,
          user_id: technician.user_id,
          reading_date: dateForDb,
          details: {
            create: [
              {
                reading_type_id: wbpType.reading_type_id,
                value: lastReadings[elecMeter.meter_id].wbp,
              },
              {
                reading_type_id: lwbpType.reading_type_id,
                value: lastReadings[elecMeter.meter_id].lwbp,
              },
            ],
          },
        },
      });
      await createOrUpdateDailySummary(tx, elecMeter.meter_id, dateForDb);
    });
    console.log(`   ✅ Data for ${elecMeter.meter_code} created.`);

    // --- Generate data untuk Meter Air ---
    const waterIncrement = getRandomIncrement(10, 25);
    lastReadings[waterMeter.meter_id].flow += waterIncrement;

    await prisma.$transaction(async (tx) => {
      await tx.readingSession.create({
        data: {
          meter_id: waterMeter.meter_id,
          user_id: technician.user_id,
          reading_date: dateForDb,
          details: {
            create: [
              {
                reading_type_id: flowType.reading_type_id,
                value: lastReadings[waterMeter.meter_id].flow,
              },
            ],
          },
        },
      });
      await createOrUpdateDailySummary(tx, waterMeter.meter_id, dateForDb);
    });
    console.log(`   ✅ Data for ${waterMeter.meter_code} created.`);

    // --- Generate data untuk Meter BBM ---
    const fuelDecrement = getRandomIncrement(2, 5); // Pemakaian mengurangi ketinggian
    lastReadings[fuelMeter.meter_id].level -= fuelDecrement;
    if (lastReadings[fuelMeter.meter_id].level < 20) {
      // Jika mau habis, isi ulang
      console.log(`     refueling ${fuelMeter.meter_code}...`);
      lastReadings[fuelMeter.meter_id].level = STARTING_FUEL_HEIGHT;
    }

    await prisma.$transaction(async (tx) => {
      await tx.readingSession.create({
        data: {
          meter_id: fuelMeter.meter_id,
          user_id: technician.user_id,
          reading_date: dateForDb,
          details: {
            create: [
              {
                reading_type_id: fuelLevelType.reading_type_id,
                value: lastReadings[fuelMeter.meter_id].level,
              },
            ],
          },
        },
      });
      await createOrUpdateDailySummary(tx, fuelMeter.meter_id, dateForDb);
    });
    console.log(`   ✅ Data for ${fuelMeter.meter_code} created.`);
  }
}

main()
  .then(() => {
    console.log('\n🎉 Dummy reading data seeding finished successfully!');
  })
  .catch((e) => {
    console.error('❌ Error seeding reading data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
