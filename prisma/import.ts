import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { Prisma, PrismaClient } from '../src/generated/prisma/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const CSV_FILE_PATH = path.join(__dirname, 'historical_data.csv');

export async function runImport() {
  console.log(`🚀 Memulai impor data historis dari ${CSV_FILE_PATH}...`);
  console.log('----------------------------------------------------');

  const technician = await prisma.user.findUniqueOrThrow({
    where: { username: 'technician' },
  });
  const meterKantor = await prisma.meter.findUniqueOrThrow({
    where: { meter_code: 'ELEC-KANTOR-01' },
  });
  const meterTerminal = await prisma.meter.findUniqueOrThrow({
    where: { meter_code: 'ELEC-TERM-01' },
  });
  // BARU: Ambil data master untuk meteran air
  const waterMeterKantor = await prisma.meter.findUniqueOrThrow({
    where: { meter_code: 'WATER-KANTOR-01' },
  });
  const waterMeterTerminal = await prisma.meter.findUniqueOrThrow({
    where: { meter_code: 'WATER-TERM-01' },
  });

  console.log('✅ Data master awal berhasil diambil dari database:');
  console.log(`   - Teknisi: ${technician.username} (ID: ${technician.user_id})`);
  console.log(`   - Meter Kantor: ${meterKantor.meter_code} (ID: ${meterKantor.meter_id})`);
  console.log(`   - Meter Terminal: ${meterTerminal.meter_code} (ID: ${meterTerminal.meter_id})`);
  console.log(
    `   - Meter Air Kantor: ${waterMeterKantor.meter_code} (ID: ${waterMeterKantor.meter_id})`,
  );
  console.log(
    `   - Meter Air Terminal: ${waterMeterTerminal.meter_code} (ID: ${waterMeterTerminal.meter_id})`,
  );

  // PERBAIKAN TOTAL: Ubah struktur untuk memastikan script menunggu semua proses selesai.
  // 1. Baca seluruh file CSV dan ubah menjadi Promise.
  const results: any[] = await new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(CSV_FILE_PATH)
      // PERBAIKAN: Gunakan mapHeaders untuk membersihkan nama kolom dari karakter BOM
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim(),
        }),
      )
      .on('data', (data) => results.push(data))
      .on('error', reject) // Tangani error saat membaca stream
      .on('end', () => resolve(results));
  });

  console.log(results[0]);

  console.log(`✅ File CSV berhasil dibaca. Ditemukan ${results.length} baris data.`);

  // 2. Filter dan urutkan data yang sudah ada di memori.
  const validResults = results
    .filter((row) => row.Tanggal && row.Tanggal.trim() !== '')
    .sort((a, b) => {
      // PERBAIKAN: Parsing tanggal sesuai format YYYY-MM-DD HH:MM:SS
      const dateA = new Date(a.Tanggal);
      const dateB = new Date(b.Tanggal);
      return dateA.getTime() - dateB.getTime();
    });

  // 3. Proses setiap baris secara sekuensial.
  for (const row of validResults) {
    // PERBAIKAN: Parsing tanggal sesuai format YYYY-MM-DD HH:MM:SS
    const tanggal = new Date(row.Tanggal);
    const pemakaianKantor = parseFloat(row['Kwh Kantor'].replace(/,/g, ''));
    const biayaKantor = row['Pemakaian Kantor'].replace(/[Rp, ]/g, '');
    const pemakaianTerminal = parseFloat(row['Kwh Terminal'].replace(/,/g, ''));
    const biayaTerminal = row['Pemakaian Terminal'].replace(/[Rp, ]/g, '');
    const pax = row.pax ? parseInt(row.pax.replace(/,/g, ''), 10) : 0;
    const waterKantor = parseFloat(row['Air Kantor']);
    const waterTerminal = parseFloat(row['Air Terminal']); // Asumsi biaya air 0
    const weatherMax = parseFloat(row.suhu_max);
    // PERBAIKAN: Koreksi typo dari suhu_rate menjadi suhu_rata
    const weatherAvg = parseFloat(row.suhu_rata);

    console.log(`\n🔄 Memproses data untuk tanggal ${row.Tanggal}...`);
    console.log(
      `   - Data setelah parsing: Listrik Kantor=${pemakaianKantor} kWh (Rp${biayaKantor}), Listrik Terminal=${pemakaianTerminal} kWh (Rp${biayaTerminal}), Pax=${pax}, Air Kantor=${waterKantor} m³, Air Terminal=${waterTerminal} m³, Suhu=${weatherAvg}°C/${weatherMax}°C`,
    );

    try {
      // Gunakan transaksi untuk memastikan semua data untuk satu hari berhasil disimpan
      await prisma.$transaction(async (tx) => {
        // 1. Simpan data Pax
        await tx.paxData.upsert({
          where: { data_date: tanggal },
          update: { total_pax: pax },
          create: { data_date: tanggal, total_pax: pax },
        });
        console.log(`   - Data Pax untuk ${row.Tanggal} disimpan: ${pax}`);

        // BARU: Simpan data cuaca
        if (!isNaN(weatherAvg) && !isNaN(weatherMax)) {
          await tx.weatherHistory.upsert({
            where: { data_date: tanggal },
            update: {
              avg_temp: weatherAvg,
              max_temp: weatherMax,
            },
            create: {
              data_date: tanggal,
              avg_temp: weatherAvg,
              max_temp: weatherMax,
            },
          });
          console.log(`   - Data Cuaca untuk ${row.Tanggal} disimpan.`);
        }

        // 2. Langsung buat/update DailySummary untuk Meter Kantor
        if (pemakaianKantor > 0) {
          console.log(`pemakaian kantor :${pemakaianKantor}`);
          console.log(`     -> Menyimpan DailySummary untuk Meter Kantor...`);
          try {
            const result = await tx.dailySummary.upsert({
              where: {
                summary_date_meter_id: {
                  summary_date: tanggal,
                  meter_id: meterKantor.meter_id,
                },
              },
              update: {
                total_consumption: pemakaianKantor,
                total_cost: new Prisma.Decimal(biayaKantor),
              },
              create: {
                summary_date: tanggal,
                meter_id: meterKantor.meter_id,
                total_consumption: pemakaianKantor,
                total_cost: new Prisma.Decimal(biayaKantor),
              },
            });
            console.log(result);

            console.log(`   ✅ Data summary untuk meter Kantor berhasil dibuat/diperbarui.`);
          } catch (error: any) {
            console.error(`   ❌ Gagal menyimpan summary meter Kantor:`, error.message);
          }
        }

        // 3. Langsung buat/update DailySummary untuk Meter Terminal
        if (pemakaianTerminal > 0) {
          console.log(`     -> Menyimpan DailySummary untuk Meter Terminal...`);
          try {
            await tx.dailySummary.upsert({
              where: {
                summary_date_meter_id: {
                  summary_date: tanggal,
                  meter_id: meterTerminal.meter_id,
                },
              },
              update: {
                total_consumption: pemakaianTerminal,
                total_cost: new Prisma.Decimal(biayaTerminal),
              },
              create: {
                summary_date: tanggal,
                total_consumption: pemakaianTerminal,
                meter_id: meterTerminal.meter_id,
                total_cost: new Prisma.Decimal(biayaTerminal),
              },
            });
            console.log(`   ✅ Data summary untuk meter Terminal berhasil dibuat/diperbarui.`);
          } catch (error: any) {
            console.error(`   ❌ Gagal menyimpan summary meter Terminal:`, error.message);
          }
        }

        // BARU: 4. Langsung buat/update DailySummary untuk Meter Air Kantor
        // PERBAIKAN: Gunakan !isNaN untuk memastikan data selalu dibuat, bahkan jika konsumsi 0.
        if (!isNaN(waterKantor)) {
          console.log(`     -> Menyimpan DailySummary untuk Meter Air Kantor...`);
          try {
            await tx.dailySummary.upsert({
              where: {
                summary_date_meter_id: {
                  summary_date: tanggal,
                  meter_id: waterMeterKantor.meter_id,
                },
              },
              update: {
                total_consumption: waterKantor,
                total_cost: 0, // Asumsi biaya air 0
              },
              create: {
                summary_date: tanggal,
                meter_id: waterMeterKantor.meter_id,
                total_consumption: waterKantor,
                total_cost: 0,
              },
            });
            console.log(`   ✅ Data summary untuk meter Air Kantor berhasil dibuat/diperbarui.`);
          } catch (error: any) {
            console.error(`   ❌ Gagal menyimpan summary meter Air Kantor:`, error.message);
          }
        }

        // BARU: 5. Langsung buat/update DailySummary untuk Meter Air Terminal
        // PERBAIKAN: Gunakan !isNaN untuk memastikan data selalu dibuat, bahkan jika konsumsi 0.
        if (!isNaN(waterTerminal)) {
          console.log(`     -> Menyimpan DailySummary untuk Meter Air Terminal...`);
          try {
            await tx.dailySummary.upsert({
              where: {
                summary_date_meter_id: {
                  summary_date: tanggal,
                  meter_id: waterMeterTerminal.meter_id,
                },
              },
              update: {
                total_consumption: waterTerminal,
                total_cost: 0, // Asumsi biaya air 0
              },
              create: {
                summary_date: tanggal,
                meter_id: waterMeterTerminal.meter_id,
                total_consumption: waterTerminal,
                total_cost: 0,
              },
            });
            console.log(`   ✅ Data summary untuk meter Air Terminal berhasil dibuat/diperbarui.`);
          } catch (error: any) {
            console.error(`   ❌ Gagal menyimpan summary meter Air Terminal:`, error.message);
          }
        }
      });
    } catch (error: any) {
      // Tangani error duplikat dengan baik
      if (error.code === 'P2002') {
        console.warn(
          `   ⚠️  Gagal karena duplikasi data untuk ${row.Tanggal}, seharusnya ditangani oleh upsert. Error: ${error.message}`,
        );
      } else {
        console.error(`   ❌ Gagal memproses data untuk ${row.Tanggal}:`, error.message);
      }
    }
  }

  console.log('\n🎉 Impor data historis selesai!');
  console.log('----------------------------------------------------');
}

// PERBAIKAN: Panggil fungsi runImport agar script ini bisa dieksekusi.
runImport()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat menjalankan impor:', e);
    // PERBAIKAN: Pastikan koneksi ditutup bahkan jika ada error
    process.exit(1);
  })
  .finally(async () => {
    // PERBAIKAN: Pastikan koneksi ditutup setelah semua selesai
    await prisma.$disconnect();
  });
