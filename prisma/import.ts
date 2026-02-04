import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import prisma from '../src/configs/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE_PATH = path.join(__dirname, 'historical_data.csv');

export async function runImport() {
  console.log(`🚀 Memulai impor data (Terminal, Office, & Pax)...`);

  // --- 1. Ambil Data Master Meter & Reading Type ---
  const meterKantor = await prisma.meter.findFirst({
    where: { category: { name: 'Office' } },
  });

  const meterTerminal = await prisma.meter.findFirst({
    where: { category: { name: 'Terminal' } },
  });

  const wbpType = await prisma.readingType.findFirst({
    where: { type_name: 'WBP' },
  });

  const lwbpType = await prisma.readingType.findFirst({
    where: { type_name: 'LWBP' },
  });

  const kwhTotalType = await prisma.readingType.findFirst({
    where: { type_name: 'Total Kantor' },
  });

  // Validasi
  if (!meterKantor || !meterTerminal) {
    console.error('❌ Meter tidak ditemukan. Cek seed master.');
    return;
  }
  if (!wbpType || !lwbpType || !kwhTotalType) {
    console.error('❌ Reading Type tidak lengkap. Cek seed reading_type.');
    return;
  }

  // --- 2. Baca File CSV ---
  const results: any[] = await new Promise((resolve, reject) => {
    const data: any[] = [];
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', (row) => data.push(row))
      .on('error', reject)
      .on('end', () => resolve(data));
  });

  console.log(`✅ File CSV dibaca: ${results.length} baris.`);

  // --- 3. Loop Proses Data ---
  for (const row of results) {
    if (!row.Tanggal) continue;

    // --- PERBAIKAN TANGGAL DI SINI ---
    const readingDate = new Date(row.Tanggal);

    // Paksa jam menjadi 12:00 siang (Local Time)
    // Ini mencegah tanggal mundur ke hari sebelumnya saat dikonversi ke UTC
    // Contoh: 00:00 WIB -> 17:00 UTC (Kemarin) [SALAH]
    // Fix:    12:00 WIB -> 05:00 UTC (Hari yang sama) [BENAR]
    readingDate.setHours(12, 0, 0, 0);

    // Parsing Data Listrik (Float)
    const valWBP = parseFloat((row.WBP ?? '0').replace(/,/g, ''));
    const valLWBP = parseFloat((row.LWBP ?? '0').replace(/,/g, ''));
    const valKwhKantor = parseFloat((row['Kwh Kantor'] ?? '0').replace(/,/g, ''));

    // Parsing Data Pax
    const valPax = parseInt((row.pax ?? '0').replace(/,/g, ''), 10);

    // Skip jika baris benar-benar kosong
    if (valWBP === 0 && valLWBP === 0 && valKwhKantor === 0 && valPax === 0) continue;

    // Format tanggal untuk log agar terlihat benar di console
    const logDate = readingDate.toISOString().split('T')[0];
    console.log(
      `🔄 ${logDate} | Trm: ${valWBP}/${valLWBP} | Ofc: ${valKwhKantor} | Pax: ${valPax}`,
    );

    try {
      await prisma.$transaction(async (tx) => {
        // ==========================================
        // BAGIAN 1: PROSES METER TERMINAL (WBP & LWBP)
        // ==========================================
        if (valWBP > 0 || valLWBP > 0) {
          const sessionTerminal = await tx.readingSession.upsert({
            where: {
              unique_meter_reading_per_day: {
                meter_id: meterTerminal.meter_id,
                reading_date: readingDate,
              },
            },
            create: {
              meter_id: meterTerminal.meter_id,
              reading_date: readingDate,
            },
            update: {},
          });

          // WBP
          if (valWBP > 0) {
            await tx.readingDetail.upsert({
              where: {
                session_id_reading_type_id: {
                  session_id: sessionTerminal.session_id,
                  reading_type_id: wbpType.reading_type_id,
                },
              },
              create: {
                session_id: sessionTerminal.session_id,
                reading_type_id: wbpType.reading_type_id,
                value: valWBP,
              },
              update: { value: valWBP },
            });
          }

          // LWBP
          if (valLWBP > 0) {
            await tx.readingDetail.upsert({
              where: {
                session_id_reading_type_id: {
                  session_id: sessionTerminal.session_id,
                  reading_type_id: lwbpType.reading_type_id,
                },
              },
              create: {
                session_id: sessionTerminal.session_id,
                reading_type_id: lwbpType.reading_type_id,
                value: valLWBP,
              },
              update: { value: valLWBP },
            });
          }
        }

        // ==========================================
        // BAGIAN 2: PROSES METER OFFICE (KWH KANTOR)
        // ==========================================
        if (valKwhKantor > 0) {
          const sessionOffice = await tx.readingSession.upsert({
            where: {
              unique_meter_reading_per_day: {
                meter_id: meterKantor.meter_id,
                reading_date: readingDate,
              },
            },
            create: {
              meter_id: meterKantor.meter_id,
              reading_date: readingDate,
            },
            update: {},
          });

          await tx.readingDetail.upsert({
            where: {
              session_id_reading_type_id: {
                session_id: sessionOffice.session_id,
                reading_type_id: kwhTotalType.reading_type_id,
              },
            },
            create: {
              session_id: sessionOffice.session_id,
              reading_type_id: kwhTotalType.reading_type_id,
              value: valKwhKantor,
            },
            update: { value: valKwhKantor },
          });
        }

        // ==========================================
        // BAGIAN 3: PROSES DATA PAX
        // ==========================================
        if (valPax > 0) {
          await tx.paxData.upsert({
            where: {
              data_date: readingDate,
            },
            create: {
              data_date: readingDate,
              total_pax: valPax,
            },
            update: {
              total_pax: valPax,
            },
          });
        }
      });
    } catch (error: any) {
      console.error(`❌ Gagal memproses ${row.Tanggal}:`, error.message);
    }
  }

  console.log('\n🎉 Impor Selesai!');
}

runImport()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
