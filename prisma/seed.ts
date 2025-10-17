import {
  PrismaClient,
  Prisma,
  RoleName,
} from '../src/generated/prisma/index.js';
import bcrypt from 'bcrypt';
import { runImport } from './import.js';
import { differenceInDays } from 'date-fns';

const prisma = new PrismaClient();

// =============================================
// REPLIKASI KONSTANTA & LOGIKA DARI READING.SERVICE
// =============================================

const DEFAULT_PRICES = {
  ELECTRICITY_WBP: new Prisma.Decimal(1553.67),
  ELECTRICITY_LWBP: new Prisma.Decimal(1035.78),
  ELECTRICITY_GENERAL: new Prisma.Decimal(1650),
  WATER: new Prisma.Decimal(0),
  FUEL: new Prisma.Decimal(6800),
};

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
    prisma.efficiencyTarget.deleteMany({}),
    prisma.dailySummary.deleteMany({}),
    // PERBAIKAN: Hapus DailyLogbook sebelum Meter
    prisma.dailyLogbook.deleteMany({}),
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
    prisma.paxData.deleteMany({}), // Hapus juga data Pax
    prisma.tax.deleteMany({}),
    prisma.tariffGroup.deleteMany({}),
    prisma.annualBudget.deleteMany({}), // PERBAIKAN: Hapus data anggaran lama
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
      { name: 'Air Kantor' },
      { name: 'Air Terminal' },
      // PERBAIKAN: Kategori BBM yang lebih spesifik
      { name: 'BBM Ground Tank' },
      { name: 'BBM Daily Tank' },
    ],
  });
  const catTerminal = categories.find((c) => c.name === 'Listrik Terminal')!;
  const catWaterKantor = categories.find((c) => c.name === 'Air Kantor')!;
  const catWaterTerminal = categories.find((c) => c.name === 'Air Terminal')!;
  const catGroundTank = categories.find((c) => c.name === 'BBM Ground Tank')!;

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
  // BARU: Buat meteran untuk Kantor
  const kantorMeter = await prisma.meter.create({
    data: {
      meter_code: 'ELEC-KANTOR-01',
      energy_type_id: electricityType.energy_type_id,
      category_id: categories.find((c) => c.name === 'Listrik Perkantoran')!
        .category_id,
      tariff_group_id: tariffB2.tariff_group_id, // Asumsi golongan tarif berbeda
    },
  });
  const waterMeterKantor = await prisma.meter.create({
    data: {
      meter_code: 'WATER-KANTOR-01',
      energy_type_id: waterType.energy_type_id,
      category_id: catWaterKantor.category_id,
      tariff_group_id: tariffB2.tariff_group_id,
    },
  });
  const waterMeterTerminal = await prisma.meter.create({
    data: {
      meter_code: 'WATER-TERM-01',
      energy_type_id: waterType.energy_type_id,
      category_id: catWaterTerminal.category_id,
      tariff_group_id: tariffB2.tariff_group_id,
    },
  });
  const fuelMeter = await prisma.meter.create({
    data: {
      meter_code: 'FUEL-GT-1700', // Sesuai data: Ground Tank 1700 kVA
      energy_type_id: fuelType.energy_type_id,
      category_id: catGroundTank.category_id,
      tariff_group_id: tariffB2.tariff_group_id,
      // PERBAIKAN: Sesuaikan dengan data spesifik tangki 1700 kVA
      tank_height_cm: 231,
      tank_volume_liters: 20000,
    },
  });
  const fuelMeter800 = await prisma.meter.create({
    data: {
      meter_code: 'FUEL-GT-800', // Ground Tank 800 kVA
      energy_type_id: fuelType.energy_type_id,
      category_id: catGroundTank.category_id,
      tariff_group_id: tariffB2.tariff_group_id,
      tank_height_cm: 174,
      tank_volume_liters: 10000,
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
          { reading_type_id: wbpType.reading_type_id, value: 1553.67 },
          { reading_type_id: lwbpType.reading_type_id, value: 1035.78 },
        ],
      },
    },
  });
  // BARU: Tambahkan skema harga untuk golongan tarif B2/TR
  await prisma.priceScheme.create({
    data: {
      scheme_name: 'Tarif Dasar B2/TR 2024',
      effective_date: new Date('2024-01-01T00:00:00.000Z'),
      tariff_group_id: tariffB2.tariff_group_id,
      set_by_user_id: superAdminUser.user_id,
      rates: {
        create: [
          // Gunakan harga yang sama atau sesuaikan jika perlu
          { reading_type_id: wbpType.reading_type_id, value: 1553.67 },
          { reading_type_id: lwbpType.reading_type_id, value: 1035.78 },
          // PERBAIKAN: Tambahkan tarif untuk BBM (Fuel Level)
          { reading_type_id: fuelLevelType.reading_type_id, value: 6800 },
        ],
      },
    },
  });
  console.log('✅ Master data created.');

  // LANGKAH 5B: BUAT DATA ANGGARAN & TARGET EFISIENSI
  console.log('💰 Creating budget and efficiency target data...');
  const currentYear = new Date().getFullYear();
  // PERBAIKAN: Gunakan `create` untuk menyertakan alokasi bersarang.
  await prisma.annualBudget.create({
    data: {
      period_start: new Date(Date.UTC(currentYear, 0, 1)), // 1 Jan
      period_end: new Date(Date.UTC(currentYear, 11, 31)), // 31 Des
      energy_type_id: electricityType.energy_type_id,
      total_budget: 4_151_357_000,
      efficiency_tag: 0.95,
      allocations: {
        createMany: {
          data: [
            // Contoh alokasi: 70% ke meter Terminal, 30% ke meter Kantor
            { meter_id: elecMeter.meter_id, weight: 0.7 },
            { meter_id: kantorMeter.meter_id, weight: 0.3 },
          ],
        },
      },
    },
  });

  // Buat target awal untuk meteran listrik
  const todayForTarget = new Date();
  await prisma.efficiencyTarget.create({
    data: {
      meter_id: elecMeter.meter_id,
      kpi_name: 'Target Awal kWh Harian',
      target_value: 850, // Contoh target awal 850 kWh per hari
      target_cost: 1_200_000, // Contoh target biaya
      period_start: new Date(Date.UTC(todayForTarget.getUTCFullYear(), 0, 1)), // Dari awal tahun
      period_end: new Date(Date.UTC(todayForTarget.getUTCFullYear(), 11, 31)), // Sampai akhir tahun
      set_by_user_id: superAdminUser.user_id,
    },
  });
  console.log('✅ Budget and target data created.');

  // LANGKAH 6: BUAT DATA PEMBACAAN BBM HISTORIS
  console.log('⛽ Seeding historical fuel reading data...');
  const historicalFuelReadings = [
    // Data untuk 29 Juli 2025
    {
      meterId: fuelMeter.meter_id, // 1700 kVA
      date: new Date('2025-07-29T00:00:00.000Z'),
      value: 64.0,
    },
    {
      meterId: fuelMeter800.meter_id, // 800 kVA
      date: new Date('2025-07-29T00:00:00.000Z'),
      value: 10.0,
    },
    // Data untuk 29 Agustus 2025
    {
      meterId: fuelMeter.meter_id, // 1700 kVA
      date: new Date('2025-08-29T00:00:00.000Z'),
      value: 62.5,
    },
    {
      meterId: fuelMeter800.meter_id, // 800 kVA
      date: new Date('2025-08-29T00:00:00.000Z'),
      value: 10.0,
    },
    // Data untuk 29 September 2025
    {
      meterId: fuelMeter.meter_id, // 1700 kVA
      date: new Date('2025-09-29T00:00:00.000Z'),
      value: 59.7,
    },
    {
      meterId: fuelMeter800.meter_id, // 800 kVA
      date: new Date('2025-09-29T00:00:00.000Z'),
      value: 9.0,
    },
  ];

  // PERBAIKAN: Urutkan data berdasarkan tanggal untuk memastikan kalkulasi berurutan
  historicalFuelReadings.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Map untuk melacak pembacaan terakhir untuk setiap meter
  const lastReadings = new Map<number, { date: Date; value: number }>();
  const fuelPrice = DEFAULT_PRICES.FUEL;

  for (const reading of historicalFuelReadings) {
    await prisma.$transaction(async (tx) => {
      try {
        // 1. Buat ReadingSession untuk data mentah (cm)
        await tx.readingSession.create({
          data: {
            meter_id: reading.meterId,
            reading_date: reading.date,
            user_id: technician.user_id,
            details: {
              create: {
                reading_type_id: fuelLevelType.reading_type_id,
                value: reading.value,
              },
            },
          },
        });
        console.log(
          `   -> Berhasil memasukkan data mentah BBM untuk meter ID ${reading.meterId} pada tanggal ${reading.date.toISOString().split('T')[0]}`
        );

        // 2. Hitung dan distribusikan konsumsi ke DailySummary
        const meter =
          reading.meterId === fuelMeter.meter_id ? fuelMeter : fuelMeter800;
        const previousReading = lastReadings.get(reading.meterId);

        if (previousReading) {
          const heightDifference = new Prisma.Decimal(
            previousReading.value
          ).minus(reading.value);

          // Hanya proses jika ada konsumsi (ketinggian menurun)
          if (heightDifference.isPositive()) {
            const litersPerCm = new Prisma.Decimal(
              meter.tank_volume_liters!
            ).div(meter.tank_height_cm!);
            const totalConsumptionLiters = heightDifference.times(litersPerCm);
            const totalCost = totalConsumptionLiters.times(fuelPrice);

            // PERBAIKAN: Buat satu DailySummary untuk total konsumsi pada periode ini,
            // menggunakan tanggal pembacaan saat ini.
            console.log(
              `     -> Menghitung total konsumsi BBM untuk periode ${previousReading.date.toISOString().split('T')[0]} hingga ${reading.date.toISOString().split('T')[0]}`
            );
            await tx.dailySummary.create({
              data: {
                summary_date: reading.date,
                meter_id: reading.meterId,
                total_consumption: totalConsumptionLiters,
                total_cost: totalCost,
              },
            });
            console.log(
              `     ...Membuat 1 DailySummary dengan total konsumsi ${totalConsumptionLiters.toFixed(
                2
              )} L.`
            );
          } else {
            console.log(
              `     -> Ketinggian BBM naik atau sama, tidak ada konsumsi yang dicatat.`
            );
          }
        }

        // 3. Perbarui data pembacaan terakhir untuk meter ini
        lastReadings.set(reading.meterId, {
          date: reading.date,
          value: reading.value,
        });
      } catch (error: any) {
        if (error.code !== 'P2002') {
          // Abaikan error duplikat jika seeder dijalankan ulang
          console.error(
            `   -> Gagal memproses data BBM untuk meter ID ${reading.meterId}:`,
            error.message
          );
        }
      }
    });
  }
  console.log('✅ Historical fuel data created.');
}

main().then(() => {
  console.log('\n🎉 Database master data seeding finished successfully!');
  // PERBAIKAN: Hapus pemanggilan runImport() dari seeder.
  // Impor data CSV harus dijalankan sebagai perintah terpisah.
});
