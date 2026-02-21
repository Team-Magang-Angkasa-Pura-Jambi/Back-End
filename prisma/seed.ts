import bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Seeding...');

  // Hapus data lama agar tidak duplikat saat dijalankan ulang

  await prisma.meterReadingConfig.deleteMany({});

  await prisma.meter.deleteMany({});

  await prisma.user.deleteMany({});

  await prisma.readingType.deleteMany({});

  await prisma.energyType.deleteMany({});

  await prisma.role.deleteMany({});

  console.log('🧹 Database cleaned');

  // --- 1. SEED ROLES ---

  const roles = ['SUPER_ADMIN', 'ADMIN', 'TECHNICIAN'] as const;

  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { role_name: roleName },

      update: {},

      create: { role_name: roleName },
    });
  }

  console.log('✅ Roles seeded');

  // --- 2. SEED ENERGY TYPES ---

  // Disesuaikan dengan skema: Electricity, Water, Fuel

  const energyTypes = [
    { energy_type_id: 1, name: 'Electricity', unit_standard: 'kWh' },

    { energy_type_id: 2, name: 'Water', unit_standard: 'm3' },

    { energy_type_id: 3, name: 'Fuel', unit_standard: 'Liters' },
  ];

  for (const et of energyTypes) {
    await prisma.energyType.upsert({
      where: { energy_type_id: et.energy_type_id },

      update: { name: et.name, unit_standard: et.unit_standard },

      create: et,
    });
  }

  console.log('✅ Energy Types seeded');

  // --- 3. SEED READING TYPES ---

  // Disinilah letak variabel-variabel yang akan muncul di Formula Builder

  const readingTypes = [
    // Listrik (Energy Type 1)

    { reading_type_id: 1, type_name: 'WBP', unit: 'kWh', energy_type_id: 1 },

    { reading_type_id: 2, type_name: 'LWBP', unit: 'kWh', energy_type_id: 1 },

    { reading_type_id: 3, type_name: 'Total kWh', unit: 'kWh', energy_type_id: 1 },

    { reading_type_id: 4, type_name: 'kVARh', unit: 'kVARh', energy_type_id: 1 },

    { reading_type_id: 5, type_name: 'Stand Pagi', unit: 'kWh', energy_type_id: 1 },

    { reading_type_id: 6, type_name: 'Stand Sore', unit: 'kWh', energy_type_id: 1 },

    { reading_type_id: 7, type_name: 'Stand Malam', unit: 'kWh', energy_type_id: 1 },

    // Air (Energy Type 2)

    { reading_type_id: 8, type_name: 'Water Flow', unit: 'm3', energy_type_id: 2 },

    { reading_type_id: 9, type_name: 'Water Pressure', unit: 'Bar', energy_type_id: 2 },

    // BBM (Energy Type 3)

    { reading_type_id: 10, type_name: 'Fuel Level', unit: 'cm', energy_type_id: 3 },

    { reading_type_id: 11, type_name: 'Fuel Volume', unit: 'Liters', energy_type_id: 3 },
  ];

  for (const type of readingTypes) {
    await prisma.readingType.upsert({
      where: { reading_type_id: type.reading_type_id },

      update: { unit: type.unit, type_name: type.type_name, energy_type_id: type.energy_type_id },

      create: type,
    });
  }

  console.log('✅ Reading Types seeded');

  // --- 4. SEED METERS ---

  const meterPLN = await prisma.meter.upsert({
    where: { meter_code: 'MTR-PLN-001' },

    update: {},

    create: {
      meter_code: 'MTR-PLN-001',

      name: 'Meter Induk PLN',

      energy_type_id: 1, // Listrik

      is_virtual: false,
    },
  });

  const meterKantor = await prisma.meter.upsert({
    where: { meter_code: 'MTR-OFF-001' },

    update: {},

    create: {
      meter_code: 'MTR-OFF-001',

      name: 'Meter Lokal Kantor',

      energy_type_id: 1, // Listrik

      is_virtual: false,
    },
  });

  const meterTerminal = await prisma.meter.upsert({
    where: { meter_code: 'MTR-TRM-001' },

    update: {},

    create: {
      meter_code: 'MTR-TRM-001',

      name: 'Meter PLN Terminal',

      energy_type_id: 1, // Listrik

      is_virtual: true, // Set sebagai virtual meter
    },
  });

  console.log('✅ Meters seeded');

  // --- 5. SEED METER READING CONFIGS (Sensor yang aktif di tiap meter) ---

  const meterConfigs = [
    // Meter PLN: WBP (1), LWBP (2)

    { meter_id: meterPLN.meter_id, reading_type_id: 1 },

    { meter_id: meterPLN.meter_id, reading_type_id: 2 },

    // Meter Kantor: WBP (1), LWBP (2), Pagi (5), Sore (6), Malam (7)

    { meter_id: meterKantor.meter_id, reading_type_id: 1 },

    { meter_id: meterKantor.meter_id, reading_type_id: 2 },

    { meter_id: meterKantor.meter_id, reading_type_id: 5 },

    { meter_id: meterKantor.meter_id, reading_type_id: 6 },

    { meter_id: meterKantor.meter_id, reading_type_id: 7 },

    // Meter Terminal (Virtual): WBP (1), LWBP (2)

    { meter_id: meterTerminal.meter_id, reading_type_id: 1 },

    { meter_id: meterTerminal.meter_id, reading_type_id: 2 },
  ];

  for (const conf of meterConfigs) {
    await prisma.meterReadingConfig.upsert({
      where: {
        meter_id_reading_type_id: {
          meter_id: conf.meter_id,

          reading_type_id: conf.reading_type_id,
        },
      },

      update: {},

      create: conf,
    });
  }

  console.log('✅ Meter Reading Configs seeded');

  // --- 6. SEED USERS ---

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const superAdminRole = await prisma.role.findUnique({ where: { role_name: 'SUPER_ADMIN' } });

  const roleId = superAdminRole?.role_id ?? 1;

  await prisma.user.upsert({
    where: { user_id: 1 },

    update: { username: 'system', email: 'system@sentinel.local' },

    create: {
      user_id: 1,

      username: 'system',

      email: 'system@sentinel.local',

      password_hash: hashedPassword,

      full_name: 'System Administrator',

      role_id: roleId,
    },
  });

  await prisma.user.upsert({
    where: { user_id: 2 },

    update: { username: 'quls_admin', email: 'admin@sentinel.local' },

    create: {
      user_id: 2,

      username: 'quls_admin',

      email: 'admin@sentinel.local',

      password_hash: hashedPassword,

      full_name: 'Yudi Admin Sentinel',

      role_id: roleId,
    },
  });

  console.log('✅ Users seeded');

  console.log('🚀 Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);

    process.exit(1);
  })

  .finally(async () => {
    await prisma.$disconnect();
  });
