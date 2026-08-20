import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import prisma from '../src/configs/db.js'; // Pastikan path ini benar

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE_PATH = path.join(__dirname, 'historical_data.csv');

export async function runImport() {
  console.log(`🚀 Memulai impor data (Terminal, Office, Pax, & Water)...`);

  // ====================================================
  // 1. AMBIL DATA MASTER (METER & READING TYPE)
  // ====================================================

  // A. Ambil Meter
  const meterKantor = await prisma.meter.findFirst({
    where: { category: 'KANTOR' },
  });

  const meterTerminal = await prisma.meter.findFirst({
    where: { category: 'TERMINAL', energy_type: { name: 'Electricity' } },
  });

  const meterAirTerminal = await prisma.meter.findFirst({
    where: { category: 'TERMINAL', energy_type: { name: 'Water' } },
  });

  // B. Reading Types (Listrik)
  const wbpType = await prisma.readingType.findFirst({ where: { type_name: 'WBP' } });
  const lwbpType = await prisma.readingType.findFirst({ where: { type_name: 'LWBP' } });
  const pagiType = await prisma.readingType.findFirst({ where: { type_name: 'Pagi' } });
  const soreType = await prisma.readingType.findFirst({ where: { type_name: 'Sore' } });
  const malamType = await prisma.readingType.findFirst({ where: { type_name: 'Malam' } });

  // C. Reading Types (Air)
  const waterType = await prisma.readingType.findFirst({ where: { type_name: 'Water Flow' } });

  // Validasi Master Data
  if (!meterKantor || !meterTerminal) {
    console.error('❌ Meter Listrik (Office/Terminal) tidak ditemukan.');
    return;
  }
  if (!meterAirTerminal) {
    console.warn('⚠️ Meter Air Terminal tidak ditemukan. Data air akan dilewati.');
  }

  if (!wbpType || !lwbpType || !pagiType || !soreType || !malamType || !waterType) {
    console.error(
      '❌ Salah satu Reading Type tidak ditemukan (Cek seed: WBP, LWBP, Pagi, Sore, Malam, Water Flow).',
    );
    return;
  }

  // ====================================================
  // 2. BACA FILE CSV
  // ====================================================
  const results: any[] = await new Promise((resolve, reject) => {
    const data: any[] = [];
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim(), // Trim spasi nama kolom
        }),
      )
      .on('data', (row) => data.push(row))
      .on('error', reject)
      .on('end', () => resolve(data));
  });

  console.log(`✅ File CSV dibaca: ${results.length} baris.`);

  // ====================================================
  // 3. LOOP PROSES DATA
  // ====================================================
  for (const row of results) {
    if (!row.Tanggal) continue;

    // --- A. Parsing Tanggal ---
    const readingDate = new Date(row.Tanggal);
    if (isNaN(readingDate.getTime())) {
      console.error(`⚠️ Tanggal tidak valid: ${row.Tanggal}`);
      continue;
    }
    // Set jam ke 12:00 siang (Local Time) untuk aman dari timezone
    readingDate.setHours(12, 0, 0, 0);

    // --- B. Parsing Angka (Helper) ---
    const cleanNum = (val: string | undefined) => {
      if (!val) return 0;
      return parseFloat(val.replace(/,/g, ''));
    };

    // 1. Listrik Terminal
    const valWbpTerminal = cleanNum(row['WBP TERMINAL']);
    const valLwbpTerminal = cleanNum(row['LWBP TERMINAL']);

    // 2. Listrik Kantor
    const valKantorPagi = cleanNum(row['Kantor Pagi']);
    const valKantorSore = cleanNum(row['Kantor Sore']);
    const valKantorMalam = cleanNum(row['Kantor Malam']);

    // 3. Air Terminal (Header Baru: 'meter air terminal')
    const valWaterTerminal = cleanNum(row['meter air terminal']);

    // 4. Pax
    const valPax = parseInt((row.pax ?? '0').replace(/,/g, ''), 10);

    // Skip jika baris kosong semua
    if (
      valWbpTerminal === 0 &&
      valLwbpTerminal === 0 &&
      valKantorPagi === 0 &&
      valKantorSore === 0 &&
      valKantorMalam === 0 &&
      valWaterTerminal === 0 &&
      valPax === 0
    )
      continue;

    const logDate = readingDate.toISOString().split('T')[0];
    console.log(
      `🔄 ${logDate} | Elec: ${valWbpTerminal}/${valLwbpTerminal} | Water: ${valWaterTerminal} | Ofc: P${valKantorPagi}/S${valKantorSore}/M${valKantorMalam} | Pax: ${valPax}`,
    );

    try {
      await prisma.$transaction(async (tx) => {
        // Helper untuk upsert detail tanpa unique constraint
        const upsertDetailHelper = async (sessionId: number, typeId: number, val: number) => {
          const existing = await tx.readingDetail.findFirst({
            where: { session_id: sessionId, reading_type_id: typeId },
          });
          if (existing) {
            await tx.readingDetail.update({
              where: { detail_id: existing.detail_id },
              data: { value: val },
            });
          } else {
            await tx.readingDetail.create({
              data: { session_id: sessionId, reading_type_id: typeId, value: val },
            });
          }
        };

        // ------------------------------------------
        // BLOCK 1: TERMINAL LISTRIK (WBP & LWBP)
        // ------------------------------------------
        if (valWbpTerminal > 0 || valLwbpTerminal > 0) {
          const sessionTerminal = await tx.readingSession.upsert({
            where: {
              meter_id_reading_date: {
                meter_id: meterTerminal.meter_id,
                reading_date: readingDate,
              },
            },
            create: { meter_id: meterTerminal.meter_id, reading_date: readingDate },
            update: {},
          });

          // WBP
          if (valWbpTerminal > 0) {
            await upsertDetailHelper(sessionTerminal.session_id, wbpType.reading_type_id, valWbpTerminal);
          }

          // LWBP
          if (valLwbpTerminal > 0) {
            await upsertDetailHelper(sessionTerminal.session_id, lwbpType.reading_type_id, valLwbpTerminal);
          }
        }

        // ------------------------------------------
        // BLOCK 2: KANTOR LISTRIK (Pagi, Sore, Malam)
        // ------------------------------------------
        if (valKantorPagi > 0 || valKantorSore > 0 || valKantorMalam > 0) {
          const sessionOffice = await tx.readingSession.upsert({
            where: {
              meter_id_reading_date: {
                meter_id: meterKantor.meter_id,
                reading_date: readingDate,
              },
            },
            create: { meter_id: meterKantor.meter_id, reading_date: readingDate },
            update: {},
          });

          if (valKantorPagi > 0) {
            await upsertDetailHelper(sessionOffice.session_id, pagiType.reading_type_id, valKantorPagi);
          }
          if (valKantorSore > 0) {
            await upsertDetailHelper(sessionOffice.session_id, soreType.reading_type_id, valKantorSore);
          }
          if (valKantorMalam > 0) {
            await upsertDetailHelper(sessionOffice.session_id, malamType.reading_type_id, valKantorMalam);
          }
        }

        // ------------------------------------------
        // BLOCK 3: PAX (Penumpang)
        // ------------------------------------------
        if (valPax > 0) {
          const existingPax = await tx.paxData.findFirst({
            where: { date: readingDate, location_id: null, session_id: null },
          });
          if (existingPax) {
            await tx.paxData.update({
              where: { pax_id: existingPax.pax_id },
              data: { pax_count: valPax },
            });
          } else {
            await tx.paxData.create({
              data: { date: readingDate, pax_count: valPax, location_id: null, session_id: null },
            });
          }
        }

        // ------------------------------------------
        // BLOCK 4: TERMINAL AIR (Water)
        // ------------------------------------------
        if (meterAirTerminal && valWaterTerminal > 0) {
          // 1. Session Air
          const sessionWater = await tx.readingSession.upsert({
            where: {
              meter_id_reading_date: {
                meter_id: meterAirTerminal.meter_id,
                reading_date: readingDate,
              },
            },
            create: { meter_id: meterAirTerminal.meter_id, reading_date: readingDate },
            update: {},
          });

          // 2. Detail Air (Stand Meter)
          await upsertDetailHelper(sessionWater.session_id, waterType.reading_type_id, valWaterTerminal);
        }
      });
    } catch (error: any) {
      console.error(`❌ Gagal memproses ${row.Tanggal}:`, error.message);
    }
  }

  console.log('\n🎉 Impor Selesai!');
}

// Jalankan
runImport()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
