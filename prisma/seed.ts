import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Seeding...');

  // --- 0. CLEANUP ---
  await prisma.meterReadingConfig.deleteMany({});
  await prisma.formulaDefinition.deleteMany({});
  await prisma.calculationTemplate.deleteMany({});
  await prisma.meter.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.readingType.deleteMany({});
  await prisma.energyType.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.notification.deleteMany({});
  console.log('🧹 Database cleaned');

  // --- 1. SEED ROLES ---
  const roles = ['SUPER_ADMIN', 'ADMIN', 'TECHNICIAN'] as const;
  const dbRoles: Record<string, any> = {};
  for (const roleName of roles) {
    dbRoles[roleName] = await prisma.role.create({
      data: { role_name: roleName },
    });
  }
  console.log('✅ Roles seeded');

  // --- 2. SEED ENERGY TYPES ---
  const energyTypesData = [
    { name: 'Electricity', unit_standard: 'kWh' },
    { name: 'Water', unit_standard: 'm3' },
    { name: 'Fuel', unit_standard: 'Liters' },
  ];

  const dbEnergy: Record<string, any> = {};
  for (const et of energyTypesData) {
    dbEnergy[et.name] = await prisma.energyType.create({
      data: et,
    });
  }
  console.log('✅ Energy Types seeded');

  // --- 3. SEED READING TYPES ---
  const readingTypesData = [
    // Listrik Induk
    { type_name: 'WBP', unit: 'kWh', energy_type_id: dbEnergy['Electricity'].energy_type_id },
    { type_name: 'LWBP', unit: 'kWh', energy_type_id: dbEnergy['Electricity'].energy_type_id },
    { type_name: 'Total kWh', unit: 'kWh', energy_type_id: dbEnergy['Electricity'].energy_type_id },
    { type_name: 'kVARh', unit: 'kVARh', energy_type_id: dbEnergy['Electricity'].energy_type_id },
    
    // Listrik Kantor
    { type_name: 'Pagi', unit: 'kWh', energy_type_id: dbEnergy['Electricity'].energy_type_id },
    { type_name: 'Sore', unit: 'kWh', energy_type_id: dbEnergy['Electricity'].energy_type_id },
    { type_name: 'Malam', unit: 'kWh', energy_type_id: dbEnergy['Electricity'].energy_type_id },
    
    // Air & BBM
    { type_name: 'Water Flow', unit: 'm3', energy_type_id: dbEnergy['Water'].energy_type_id },
    { type_name: 'Fuel Volume', unit: 'Liters', energy_type_id: dbEnergy['Fuel'].energy_type_id },
  ];

  const dbReading: Record<string, any> = {};
  for (const rt of readingTypesData) {
    dbReading[rt.type_name] = await prisma.readingType.create({
      data: rt,
    });
  }
  console.log('✅ Reading Types seeded');

  // --- 4. SEED CALCULATION TEMPLATES (Dengan Validations di Induk) ---
  const TPL_ELEC_ID = crypto.randomUUID();
  const TPL_KANTOR_ID = crypto.randomUUID();
  const TPL_WATER_ID = crypto.randomUUID();
  const TPL_FUEL_ID = crypto.randomUUID();

  // 4a. Buat Induk Template beserta array Validations-nya
  await prisma.calculationTemplate.createMany({
    data: [
      {
        template_id: TPL_ELEC_ID,
        name: 'Template PLN Standar (WBP & LWBP)',
        description: 'Kalkulasi pemakaian WBP dan LWBP harian dengan faktor multiplier.',
        validations: [
          { rule: 'LWBP_Skrg >= LWBP_Kmrn', error_message: 'Stand LWBP hari ini tidak boleh lebih kecil dari kemarin' },
          { rule: 'WBP_Skrg >= WBP_Kmrn', error_message: 'Stand WBP hari ini tidak boleh lebih kecil dari kemarin' },
        ],
      },
      {
        template_id: TPL_KANTOR_ID,
        name: 'Template PLN Kantor (Pagi, Sore, Malam)',
        description: 'Kalkulasi pemakaian terpisah 3 shift dan validasi total harian.',
        validations: [
          { rule: 'Sore_Skrg >= Pagi_Skrg', error_message: 'Stand Sore tidak boleh turun dari Pagi' },
          { rule: 'Malam_Skrg >= Sore_Skrg', error_message: 'Stand Malam tidak boleh turun dari Sore' },
        ],
      },
      {
        template_id: TPL_WATER_ID,
        name: 'Template Air Standar',
        description: 'Kalkulasi volume air berdasarkan selisih flow meter.',
        validations: [],
      },
      {
        template_id: TPL_FUEL_ID,
        name: 'Template BBM Standar',
        description: 'Kalkulasi konsumsi BBM berdasarkan flow rate liter.',
        validations: [],
      },
    ],
  });

  // 4b. Tanam Formula Definition (Validations sudah dihapus dari sini)
  await prisma.formulaDefinition.createMany({
    data: [
      // == DEFINISI: LISTRIK INDUK ==
      {
        template_id: TPL_ELEC_ID,
        name: 'Pemakaian LWBP',
        is_main: false,
        formula_items: {
          formula: 'LWBP_Skrg - LWBP_Kmrn',
          variables: [
            { label: 'LWBP_Skrg', type: 'reading', readingTypeId: dbReading['LWBP'].reading_type_id, timeShift: 0 },
            { label: 'LWBP_Kmrn', type: 'reading', readingTypeId: dbReading['LWBP'].reading_type_id, timeShift: -1 },
          ],
        },
      },
      {
        template_id: TPL_ELEC_ID,
        name: 'Pemakaian WBP',
        is_main: false,
        formula_items: {
          formula: 'WBP_Skrg - WBP_Kmrn',
          variables: [
            { label: 'WBP_Skrg', type: 'reading', readingTypeId: dbReading['WBP'].reading_type_id, timeShift: 0 },
            { label: 'WBP_Kmrn', type: 'reading', readingTypeId: dbReading['WBP'].reading_type_id, timeShift: -1 },
          ],
        },
      },
      {
        template_id: TPL_ELEC_ID,
        name: 'Total Pemakaian Listrik',
        is_main: true,
        formula_items: {
          formula: '((LWBP_Skrg - LWBP_Kmrn) + (WBP_Skrg - WBP_Kmrn)) * Faktor',
          variables: [
            { label: 'LWBP_Skrg', type: 'reading', readingTypeId: dbReading['LWBP'].reading_type_id, timeShift: 0 },
            { label: 'LWBP_Kmrn', type: 'reading', readingTypeId: dbReading['LWBP'].reading_type_id, timeShift: -1 },
            { label: 'WBP_Skrg', type: 'reading', readingTypeId: dbReading['WBP'].reading_type_id, timeShift: 0 },
            { label: 'WBP_Kmrn', type: 'reading', readingTypeId: dbReading['WBP'].reading_type_id, timeShift: -1 },
            { label: 'Faktor', type: 'spec', specField: 'multiplier' },
          ],
        },
      },

      // == DEFINISI: LISTRIK KANTOR ==
      {
        template_id: TPL_KANTOR_ID,
        name: 'Pemakaian Pagi',
        is_main: false,
        formula_items: {
          formula: 'Pagi_Skrg - Pagi_Kmrn',
          variables: [
            { label: 'Pagi_Skrg', type: 'reading', readingTypeId: dbReading['Pagi'].reading_type_id, timeShift: 0 },
            { label: 'Pagi_Kmrn', type: 'reading', readingTypeId: dbReading['Pagi'].reading_type_id, timeShift: -1 },
          ],
        },
      },
      {
        template_id: TPL_KANTOR_ID,
        name: 'Pemakaian Sore',
        is_main: false,
        formula_items: {
          formula: 'Sore_Skrg - Sore_Kmrn',
          variables: [
            { label: 'Sore_Skrg', type: 'reading', readingTypeId: dbReading['Sore'].reading_type_id, timeShift: 0 },
            { label: 'Sore_Kmrn', type: 'reading', readingTypeId: dbReading['Sore'].reading_type_id, timeShift: -1 },
          ],
        },
      },
      {
        template_id: TPL_KANTOR_ID,
        name: 'Pemakaian Malam',
        is_main: false,
        formula_items: {
          formula: 'Malam_Skrg - Malam_Kmrn',
          variables: [
            { label: 'Malam_Skrg', type: 'reading', readingTypeId: dbReading['Malam'].reading_type_id, timeShift: 0 },
            { label: 'Malam_Kmrn', type: 'reading', readingTypeId: dbReading['Malam'].reading_type_id, timeShift: -1 },
          ],
        },
      },
      {
        template_id: TPL_KANTOR_ID,
        name: 'Total Pemakaian Kantor',
        is_main: true,
        formula_items: {
          formula: '((Pagi_Skrg - Pagi_Kmrn) + (Sore_Skrg - Sore_Kmrn) + (Malam_Skrg - Malam_Kmrn)) * Faktor',
          variables: [
            { label: 'Pagi_Skrg', type: 'reading', readingTypeId: dbReading['Pagi'].reading_type_id, timeShift: 0 },
            { label: 'Pagi_Kmrn', type: 'reading', readingTypeId: dbReading['Pagi'].reading_type_id, timeShift: -1 },
            { label: 'Sore_Skrg', type: 'reading', readingTypeId: dbReading['Sore'].reading_type_id, timeShift: 0 },
            { label: 'Sore_Kmrn', type: 'reading', readingTypeId: dbReading['Sore'].reading_type_id, timeShift: -1 },
            { label: 'Malam_Skrg', type: 'reading', readingTypeId: dbReading['Malam'].reading_type_id, timeShift: 0 },
            { label: 'Malam_Kmrn', type: 'reading', readingTypeId: dbReading['Malam'].reading_type_id, timeShift: -1 },
            { label: 'Faktor', type: 'spec', specField: 'multiplier' },
          ],
        },
      },

      // == DEFINISI: AIR ==
      {
        template_id: TPL_WATER_ID,
        name: 'Total Pemakaian Air',
        is_main: true,
        formula_items: {
          formula: '(Water_Skrg - Water_Kmrn) * Faktor',
          variables: [
            { label: 'Water_Skrg', type: 'reading', readingTypeId: dbReading['Water Flow'].reading_type_id, timeShift: 0 },
            { label: 'Water_Kmrn', type: 'reading', readingTypeId: dbReading['Water Flow'].reading_type_id, timeShift: -1 },
            { label: 'Faktor', type: 'spec', specField: 'multiplier' },
          ],
        },
      },

      // == DEFINISI: BBM ==
      {
        template_id: TPL_FUEL_ID,
        name: 'Total Konsumsi BBM',
        is_main: true,
        formula_items: {
          formula: '(Fuel_Skrg - Fuel_Kmrn) * Faktor',
          variables: [
            { label: 'Fuel_Skrg', type: 'reading', readingTypeId: dbReading['Fuel Volume'].reading_type_id, timeShift: 0 },
            { label: 'Fuel_Kmrn', type: 'reading', readingTypeId: dbReading['Fuel Volume'].reading_type_id, timeShift: -1 },
            { label: 'Faktor', type: 'spec', specField: 'multiplier' },
          ],
        },
      },
    ],
  });
  console.log('✅ Calculation Templates & Formulas seeded (New Structure)');

  // --- 5. SEED METERS ---
  const metersData = [
    {
      meter_code: 'MTR-PLN-001',
      name: 'Meter Induk PLN',
      energy_type_id: dbEnergy['Electricity'].energy_type_id,
      calculation_template_id: TPL_ELEC_ID,
      category: 'TERMINAL' as const,
      multiplier: 1.5,
    },
    {
      meter_code: 'MTR-PLN-KTR',
      name: 'Meter PLN Kantor Utama',
      energy_type_id: dbEnergy['Electricity'].energy_type_id,
      calculation_template_id: TPL_KANTOR_ID,
      category: 'KANTOR' as const,
      multiplier: 1.0,
    },
    {
      meter_code: 'MTR-WAT-001',
      name: 'Meter Air Induk PDAM',
      energy_type_id: dbEnergy['Water'].energy_type_id,
      calculation_template_id: TPL_WATER_ID,
      category: 'LAINNYA' as const,
      multiplier: 1.0,
    },
    {
      meter_code: 'MTR-FUL-001',
      name: 'Flowmeter Tangki Genset',
      energy_type_id: dbEnergy['Fuel'].energy_type_id,
      calculation_template_id: TPL_FUEL_ID,
      category: 'LAINNYA' as const,
      multiplier: 1.0,
    },
  ];

  const dbMeters: Record<string, any> = {};
  for (const  m of metersData) {
    dbMeters[m.meter_code] = await prisma.meter.create({ data: m });
  }
  console.log('✅ Meters seeded');

  // --- 6. SEED METER READING CONFIGS ---
  const meterConfigs = [
    { meter_id: dbMeters['MTR-PLN-001'].meter_id, reading_type_id: dbReading['WBP'].reading_type_id },
    { meter_id: dbMeters['MTR-PLN-001'].meter_id, reading_type_id: dbReading['LWBP'].reading_type_id },
    { meter_id: dbMeters['MTR-PLN-KTR'].meter_id, reading_type_id: dbReading['Pagi'].reading_type_id },
    { meter_id: dbMeters['MTR-PLN-KTR'].meter_id, reading_type_id: dbReading['Sore'].reading_type_id },
    { meter_id: dbMeters['MTR-PLN-KTR'].meter_id, reading_type_id: dbReading['Malam'].reading_type_id },
    { meter_id: dbMeters['MTR-WAT-001'].meter_id, reading_type_id: dbReading['Water Flow'].reading_type_id },
    { meter_id: dbMeters['MTR-FUL-001'].meter_id, reading_type_id: dbReading['Fuel Volume'].reading_type_id },
  ];

  await prisma.meterReadingConfig.createMany({ data: meterConfigs });
  console.log('✅ Meter Reading Configs seeded');

  // --- 7. SEED USERS ---
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const systemUser = await prisma.user.create({
    data: {
      username: 'system',
      email: 'system@sentinel.local',
      password_hash: hashedPassword,
      full_name: 'System Administrator',
      role_id: dbRoles['SUPER_ADMIN'].role_id,
    },
  });
  console.log('✅ Users seeded');

  // --- 8. SEED DUMMY NOTIFICATIONS ---
  console.log('⏳ Seeding Dummy Notifications...');
  const notificationCategories = ['SYSTEM', 'THRESHOLD_BREACH', 'ANOMALY_DETECTED', 'MAINTENANCE', 'BUDGET_WARNING', 'DATA_ENTRY'] as const;
  const dummyNotifications = [];

  const getRandomDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 7));
    date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
    return date;
  };

  for (const category of notificationCategories) {
    for (let i = 1; i <= 10; i++) {
      let severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' = 'INFO';
      let title = '';
      let message = '';
      let refTable: string | null = null;
      let refId: number | null = null;

      switch (category) {
        case 'SYSTEM':
          severity = i % 3 === 0 ? 'WARNING' : i % 2 === 0 ? 'SUCCESS' : 'INFO';
          title = severity === 'WARNING' ? `Koneksi Server #0${i} Terputus` : `Sinkronisasi Data Berhasil`;
          message = `Sistem mencatat log aktivitas pada modul inti. ID Referensi Sys-${i}00${i}.`;
          break;
        case 'THRESHOLD_BREACH':
          severity = i % 4 === 0 ? 'CRITICAL' : 'WARNING';
          title = `Ambang Batas Terlampaui - Meter 0${i}`;
          message = `Konsumsi energi melonjak melebihi batas rata-rata harian sebesar ${10 + i * 5}%. Harap periksa instalasi terkait.`;
          refTable = 'meters';
          refId = dbMeters['MTR-PLN-001'].meter_id;
          break;
        case 'ANOMALY_DETECTED':
          severity = 'CRITICAL';
          title = `Anomali Terdeteksi oleh ML Model V2`;
          message = `Algoritma mendeteksi pola penggunaan tidak wajar pada dini hari. Kemungkinan indikasi kebocoran (probabilitas ${70 + i * 2}%).`;
          break;
        case 'MAINTENANCE':
          severity = i % 2 === 0 ? 'SUCCESS' : 'INFO';
          title = i % 2 === 0 ? `Perbaikan Selesai` : `Jadwal Kalibrasi Alat`;
          message = `Teknisi telah dijadwalkan untuk melakukan pengecekan berkala pada MTR-PLN-KTR.`;
          refTable = 'meters';
          refId = dbMeters['MTR-PLN-KTR'].meter_id;
          break;
        case 'BUDGET_WARNING':
          severity = i % 2 === 0 ? 'CRITICAL' : 'WARNING';
          title = severity === 'CRITICAL' ? `Budget Menipis (Tersisa 10%)` : `Penggunaan Budget Mencapai 75%`;
          message = `Alokasi dana untuk utilitas bulan ini hampir habis. Segera lakukan penyesuaian operasional.`;
          break;
        case 'DATA_ENTRY':
          severity = 'INFO';
          title = `Input Data Manual Diterima`;
          message = `Data jumlah penumpang (Pax) harian sebesar ${15000 + i * 125} telah berhasil dimasukkan ke dalam sistem.`;
          break;
      }

      dummyNotifications.push({
        user_id: systemUser.user_id,
        category: category,
        severity: severity,
        title: title,
        message: message,
        is_read: i % 3 === 0,
        reference_table: refTable,
        reference_id: refId,
        created_at: getRandomDate(),
      });
    }
  }

  await prisma.notification.createMany({ data: dummyNotifications });
  console.log(`✅ 60 Dummy Notifications seeded`);

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