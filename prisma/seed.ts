import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Seeding...');

  await prisma.user.deleteMany({});
  await prisma.readingType.deleteMany({});
  await prisma.energyType.deleteMany({});
  await prisma.role.deleteMany({});
  console.log('🧹 Database cleaned');

  const roles = ['SUPER_ADMIN', 'ADMIN', 'TECHNICIAN'] as const;
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { role_name: roleName },
      update: {},
      create: { role_name: roleName },
    });
  }
  console.log('✅ Roles seeded');

  const energyTypes = [
    { energy_type_id: 1, name: 'Electricity', unit_standard: 'kWh' },
    { energy_type_id: 2, name: 'Water', unit_standard: 'm3' },
    { energy_type_id: 3, name: 'Gas', unit_standard: 'm3' },
  ];

  for (const et of energyTypes) {
    await prisma.energyType.upsert({
      where: { energy_type_id: et.energy_type_id },
      update: { name: et.name, unit_standard: et.unit_standard },
      create: et,
    });
  }
  console.log('✅ Energy Types seeded');

  const readingTypes = [
    { reading_type_id: 1, type_name: 'Electricity Standard', unit: 'kWh', energy_type_id: 1 },
    { reading_type_id: 2, type_name: 'Water Standard', unit: 'm3', energy_type_id: 2 },
    { reading_type_id: 3, type_name: 'Gas Standard', unit: 'm3', energy_type_id: 3 },
  ];

  for (const type of readingTypes) {
    await prisma.readingType.upsert({
      where: { reading_type_id: type.reading_type_id },
      update: { unit: type.unit, type_name: type.type_name, energy_type_id: type.energy_type_id },
      create: type,
    });
  }
  console.log('✅ Reading Types seeded');

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
