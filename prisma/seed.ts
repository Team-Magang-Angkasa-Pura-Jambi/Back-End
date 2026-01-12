import { PrismaClient, RoleName } from '../src/generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding minimal master data (Admin + Energy Types)...');

  /**
   * 1️⃣ ROLE: Admin
   */
  const adminRole = await prisma.role.upsert({
    where: { role_name: RoleName.Admin },
    update: {},
    create: {
      role_name: RoleName.Admin,
    },
  });

  /**
   * 2️⃣ USER: admin
   */
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password_hash: passwordHash,
      role_id: adminRole.role_id,
    },
    create: {
      username: 'admin',
      password_hash: passwordHash,
      role_id: adminRole.role_id,
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

  console.log('✅ Admin user & default energy types seeded successfully');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
