// import { PrismaClient } from '../src/generated/prisma/index.js';

// const prisma = new PrismaClient();

// async function main() {
//   console.log('🚀 Seeding Master Data (Energy, Reading Types, Categories)...');

//   // --- 1. ENERGY TYPES (Jenis Energi) ---
//   console.log('👉 Seeding Energy Types...');

//   // awit prisma.user.upsert({update: {}, create: {username: 'admin', password_hash:'password123',role_id:}})

//   await prisma.energyType.upsert({
//     where: { type_name: 'Electricity' },
//     update: {},
//     create: { type_name: 'Electricity', unit_of_measurement: 'kWh' },
//   });

//   await prisma.energyType.upsert({
//     where: { type_name: 'Water' },
//     update: {},
//     create: { type_name: 'Water', unit_of_measurement: 'm³' },
//   });

//   await prisma.energyType.upsert({
//     where: { type_name: 'Fuel' },
//     update: {},
//     create: { type_name: 'Fuel', unit_of_measurement: 'Liter' },
//   });

//   // --- 2. READING TYPES (Tipe Pembacaan) ---
//   // PERBAIKAN: Menambahkan field 'reading_unit' yang wajib
//   console.log('👉 Seeding Reading Types...');

//   // A. Listrik (WBP & LWBP)
//   await prisma.readingType.upsert({
//     where: { type_name: 'WBP' },
//     update: {},
//     create: {
//       type_name: 'WBP',
//       reading_unit: 'kWh', // Field Wajib Baru
//       energy_type: { connect: { type_name: 'Electricity' } },
//     },
//   });

//   await prisma.readingType.upsert({
//     where: { type_name: 'LWBP' },
//     update: {},
//     create: {
//       type_name: 'LWBP',
//       reading_unit: 'kWh', // Field Wajib Baru
//       energy_type: { connect: { type_name: 'Electricity' } },
//     },
//   });

//   // B. BBM / Fuel (Flow)
//   await prisma.readingType.upsert({
//     where: { type_name: 'Flow' },
//     update: {},
//     create: {
//       type_name: 'Flow',
//       reading_unit: 'Liter', // Field Wajib Baru
//       energy_type: { connect: { type_name: 'Fuel' } },
//     },
//   });

//   // C. Air / Water (Total)
//   await prisma.readingType.upsert({
//     where: { type_name: 'Total' },
//     update: {},
//     create: {
//       type_name: 'Total',
//       reading_unit: 'm³', // Field Wajib Baru
//       energy_type: { connect: { type_name: 'Water' } },
//     },
//   });

//   // --- 3. METER CATEGORIES (Kategori Meter) ---
//   console.log('👉 Seeding Meter Categories...');

//   /**
//    * Kategori: TERMINAL
//    * Fasilitas Lengkap: Punya Listrik (WBP, LWBP), Air (Total), dan BBM (Flow)
//    */
//   await prisma.meterCategory.upsert({
//     where: { name: 'Terminal' },
//     update: {
//       allowed_reading_types: {
//         set: [], // Reset relasi lama
//         connect: [
//           { type_name: 'WBP' },
//           { type_name: 'LWBP' },
//           { type_name: 'Total' },
//           { type_name: 'Flow' },
//         ],
//       },
//     },
//     create: {
//       name: 'Terminal',
//       allowed_reading_types: {
//         connect: [
//           { type_name: 'WBP' },
//           { type_name: 'LWBP' },
//           { type_name: 'Total' },
//           { type_name: 'Flow' },
//         ],
//       },
//     },
//   });

//   /**
//    * Kategori: OFFICE
//    * Standar Kantor: Biasanya hanya Listrik dan Air
//    */
//   await prisma.meterCategory.upsert({
//     where: { name: 'Office' },
//     update: {
//       allowed_reading_types: {
//         set: [],
//         connect: [{ type_name: 'WBP' }, { type_name: 'LWBP' }, { type_name: 'Total' }],
//       },
//     },
//     create: {
//       name: 'Office',
//       allowed_reading_types: {
//         connect: [{ type_name: 'WBP' }, { type_name: 'LWBP' }, { type_name: 'Total' }],
//       },
//     },
//   });

//   /**
//    * Kategori: GENERAL
//    * Fasilitas Umum: Biasanya hanya butuh Listrik standar
//    */
//   await prisma.meterCategory.upsert({
//     where: { name: 'General' },
//     update: {
//       allowed_reading_types: {
//         set: [],
//         connect: [{ type_name: 'WBP' }, { type_name: 'LWBP' }],
//       },
//     },
//     create: {
//       name: 'General',
//       allowed_reading_types: {
//         connect: [{ type_name: 'WBP' }, { type_name: 'LWBP' }],
//       },
//     },
//   });

//   console.log('✅ Data Master (Tipe Bacaan & Kategori) berhasil dibuat!');
// }

// main()
//   .catch((error) => {
//     console.error('❌ Seeding failed:', error);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
