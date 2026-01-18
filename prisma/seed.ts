import { PrismaClient, RoleName } from '../src/generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding minimal master data...');

  /**
   * 1️⃣ ROLES: SuperAdmin, Admin, Technician
   * Kita gunakan upsert agar tidak error jika data sudah ada.
   */

  // A. Role SuperAdmin
  const superAdminRole = await prisma.role.upsert({
    where: { role_name: RoleName.SuperAdmin },
    update: {},
    create: {
      role_name: RoleName.SuperAdmin,
    },
  });

  // B. Role Admin (Kita simpan ke variabel untuk dipakai user admin di bawah)
  const adminRole = await prisma.role.upsert({
    where: { role_name: RoleName.Admin },
    update: {},
    create: {
      role_name: RoleName.Admin,
    },
  });

  // C. Role Technician
  const technician = await prisma.role.upsert({
    where: { role_name: RoleName.Technician },
    update: {},
    create: {
      role_name: RoleName.Technician,
    },
  });

  /**
   * 2️⃣ USER: admin
   * User ini dikaitkan dengan role 'Admin' (sesuai variabel adminRole di atas)
   */
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.upsert({
    where: { username: 'superdmin' },
    update: {
      password_hash: passwordHash,
      role_id: superAdminRole.role_id,
    },
    create: {
      username: 'admin',
      password_hash: passwordHash,
      role_id: superAdminRole.role_id,
    },
  });

  /**
   * 3️⃣ ENERGY TYPE DEFAULT
   * - Electricity
   * - Water
   * - Fuel
   */
  await prisma.energyType.upsert({
    where: { type_name: 'Electricity' },
    update: {},
    create: {
      type_name: 'Electricity',
      unit_of_measurement: 'kWh',
    },
  });

  await prisma.energyType.upsert({
    where: { type_name: 'Water' },
    update: {},
    create: {
      type_name: 'Water',
      unit_of_measurement: 'm³',
    },
  });

  await prisma.energyType.upsert({
    where: { type_name: 'Fuel' },
    update: {},
    create: {
      type_name: 'Fuel',
      unit_of_measurement: 'Liter',
    },
  });

  console.log('✅ Roles (SuperAdmin, Admin, Technician), User, & Energy types seeded successfully');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
