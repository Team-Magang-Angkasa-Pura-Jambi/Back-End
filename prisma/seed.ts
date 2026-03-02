import { PrismaClient, RoleName } from '../src/generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Mulai Seeding Database Lengkap (Support Import)...');

  // ==========================================
  // 1. ENERGY TYPES
  // ==========================================
  console.log('👉 Seeding Energy Types...');
  const electricity = await prisma.energyType.upsert({
    where: { type_name: 'Electricity' },
    update: {},
    create: { type_name: 'Electricity', unit_of_measurement: 'kWh' },
  });

  const water = await prisma.energyType.upsert({
    where: { type_name: 'Water' },
    update: {},
    create: { type_name: 'Water', unit_of_measurement: 'm³' },
  });

  const fuel = await prisma.energyType.upsert({
    where: { type_name: 'Fuel' },
    update: {},
    create: { type_name: 'Fuel', unit_of_measurement: 'Liter' },
  });

  // ==========================================
  // 2. READING TYPES (Sesuai Script Import)
  // ==========================================
  console.log('👉 Seeding Reading Types...');

  // Helper untuk upsert reading type
  const upsertType = async (name: string, unit: string, energyTypeId: number) => {
    return prisma.readingType.upsert({
      where: { type_name: name },
      update: {},
      create: {
        type_name: name,
        reading_unit: unit,
        energy_type_id: energyTypeId,
      },
    });
  };

  // A. Standard PLN (Terminal)
  await upsertType('WBP', 'kWh', electricity.energy_type_id);
  await upsertType('LWBP', 'kWh', electricity.energy_type_id);

  // B. Shift Kantor (Pagi, Sore, Malam) - DIPERLUKAN OLEH IMPORT
  await upsertType('Pagi', 'kWh', electricity.energy_type_id);
  await upsertType('Sore', 'kWh', electricity.energy_type_id);
  await upsertType('Malam', 'kWh', electricity.energy_type_id);

  // C. Air (Water) - DIPERLUKAN OLEH IMPORT
  // Script import mencari type_name: 'Water', bukan 'Total'
  await upsertType('Water', 'm³', water.energy_type_id);

  // D. Lainnya
  await upsertType('Flow', 'Liter', fuel.energy_type_id);

  // ==========================================
  // 3. METER CATEGORIES
  // ==========================================
  console.log('👉 Seeding Meter Categories...');

  const catTerminal = await prisma.meterCategory.upsert({
    where: { name: 'Terminal' },
    update: {
      allowed_reading_types: {
        connect: [
          { type_name: 'WBP' },
          { type_name: 'LWBP' },
          { type_name: 'Water' }, // Connect Water
        ],
      },
    },
    create: {
      name: 'Terminal',
      allowed_reading_types: {
        connect: [{ type_name: 'WBP' }, { type_name: 'LWBP' }, { type_name: 'Water' }],
      },
    },
  });

  const catOffice = await prisma.meterCategory.upsert({
    where: { name: 'Office' },
    update: {
      allowed_reading_types: {
        connect: [{ type_name: 'Pagi' }, { type_name: 'Sore' }, { type_name: 'Malam' }],
      },
    },
    create: {
      name: 'Office',
      allowed_reading_types: {
        connect: [{ type_name: 'Pagi' }, { type_name: 'Sore' }, { type_name: 'Malam' }],
      },
    },
  });

  // ==========================================
  // 4. TARIFF GROUPS (Syarat membuat Meter)
  // ==========================================
  console.log('👉 Seeding Tariff Groups...');

  const tariffB1 = await prisma.tariffGroup.upsert({
    where: { group_code: 'B-1' },
    update: {},
    create: {
      group_code: 'B-1',
      group_name: 'Bisnis Terminal',
      description: 'Tariff untuk area terminal',
      faktor_kali: 1,
    },
  });

  const tariffP1 = await prisma.tariffGroup.upsert({
    where: { group_code: 'P-1' },
    update: {},
    create: {
      group_code: 'P-1',
      group_name: 'Perkantoran',
      description: 'Tariff untuk area kantor',
      faktor_kali: 1,
    },
  });

  // ==========================================
  // 5. METERS (Fisik Meter) - KRUSIAL UNTUK IMPORT
  // ==========================================
  console.log('👉 Seeding Meters (Dummy Data for Import)...');

  // A. Meter Terminal (Listrik)
  // Script import cari: category='Terminal', energy='Electricity'
  await prisma.meter.upsert({
    where: { meter_code: 'M-TERM-ELEC-01' },
    update: {},
    create: {
      meter_code: 'M-TERM-ELEC-01',
      status: 'Active',
      energy_type_id: electricity.energy_type_id,
      category_id: catTerminal.category_id,
      tariff_group_id: tariffB1.tariff_group_id,
    },
  });

  // B. Meter Terminal (Air)
  // Script import cari: category='Terminal', energy='Water'
  await prisma.meter.upsert({
    where: { meter_code: 'M-TERM-WATER-01' },
    update: {},
    create: {
      meter_code: 'M-TERM-WATER-01',
      status: 'Active',
      energy_type_id: water.energy_type_id,
      category_id: catTerminal.category_id,
      tariff_group_id: tariffB1.tariff_group_id,
    },
  });

  // C. Meter Office (Listrik)
  // Script import cari: category='Office'
  await prisma.meter.upsert({
    where: { meter_code: 'M-OFFICE-ELEC-01' },
    update: {},
    create: {
      meter_code: 'M-OFFICE-ELEC-01',
      status: 'Active',
      energy_type_id: electricity.energy_type_id,
      category_id: catOffice.category_id,
      tariff_group_id: tariffP1.tariff_group_id,
    },
  });

  // ==========================================
  // 6. USERS & ROLES
  // ==========================================
  console.log('👉 Seeding Users & Roles...');

  const roles = [RoleName.SuperAdmin, RoleName.Admin, RoleName.Technician];
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { role_name: roleName },
      update: {},
      create: { role_name: roleName },
    });
  }

  const SALT_ROUNDS = 10;
  const passwordHash = await bcrypt.hash('123456', SALT_ROUNDS);

  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: { password_hash: passwordHash },
    create: {
      username: 'superadmin',
      password_hash: passwordHash,
      role: { connect: { role_name: RoleName.SuperAdmin } },
      photo_profile_url: 'https://ui-avatars.com/api/?name=Super+Admin',
    },
  });

  console.log('✅ Seeding Selesai! Database siap menerima Import CSV.');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
