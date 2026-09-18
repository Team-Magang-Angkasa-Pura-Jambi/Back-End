import ExcelJS from 'exceljs';
import { startOfDay, endOfDay } from 'date-fns';
import prisma from '../../../configs/db.js';
import { Error400, Error404 } from '../../../utils/customError.js';
import { _normalizeDate, _validateMeter } from '../utils/reading.utils.js';
import { readingValidator } from '../utils/reading.validator.js';
import { formulaEngine } from '../utils/formula.engine.js';
import { Prisma } from '../../../generated/prisma/index.js';

export interface ImportErrorDetail {
  row: number;
  meter_code: string;
  reading_date: string;
  message: string;
}

export interface ImportResultSummary {
  total_rows: number;
  success_count: number;
  failed_count: number;
  errors: ImportErrorDetail[];
}

export const dynamicImportParserService = {
  /**
   * Parses uploaded Excel/CSV file buffer, validates dynamic schemas, saves sessions,
   * and runs Formula Engine calculation for each session.
   */
  importReadings: async (
    fileBuffer: Buffer,
    energyTypeId: number,
    userId: number,
    meterId?: number,
  ): Promise<ImportResultSummary> => {
    const energyType = await prisma.energyType.findUnique({
      where: { energy_type_id: energyTypeId },
      include: { reading_types: true },
    });

    if (!energyType) {
      throw new Error404(`Energy type dengan ID ${energyTypeId} tidak ditemukan.`);
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch {
      throw new Error400('File yang diunggah tidak valid atau bukan format .xlsx yang didukung.');
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
      throw new Error400('Berkas spreadsheet kosong atau tidak memiliki data.');
    }

    // ----------------------------------------------------
    // 1. Parsing Header Row (Row 1)
    // ----------------------------------------------------
    const headerRow = worksheet.getRow(1);
    let meterCodeColIdx = -1;
    let dateColIdx = -1;
    let notesColIdx = -1;
    let imageColIdx = -1;

    // Map column index to reading_type_id
    const readingTypeColMap: Map<number, number> = new Map();

    headerRow.eachCell((cell, colNumber) => {
      const headerText = String(cell.value ?? '').trim();
      const lower = headerText.toLowerCase();

      if (lower.includes('kode meter')) {
        meterCodeColIdx = colNumber;
      } else if (lower.includes('tanggal')) {
        dateColIdx = colNumber;
      } else if (lower.includes('catatan')) {
        notesColIdx = colNumber;
      } else if (lower.includes('foto') || lower.includes('bukti')) {
        imageColIdx = colNumber;
      } else {
        // Try to match [ID:xxx]
        const idMatch = headerText.match(/\[ID:(\d+)\]/i);
        if (idMatch) {
          const rtId = parseInt(idMatch[1], 10);
          readingTypeColMap.set(colNumber, rtId);
        } else {
          // Fallback match reading type by name
          const matchedRt = energyType.reading_types.find((rt) =>
            headerText.toLowerCase().includes(rt.type_name.toLowerCase()),
          );
          if (matchedRt) {
            readingTypeColMap.set(colNumber, matchedRt.reading_type_id);
          }
        }
      }
    });

    if (meterCodeColIdx === -1 || dateColIdx === -1) {
      throw new Error400(
        'Header kolom wajib (Kode Meter dan Tanggal Catat) tidak ditemukan pada berkas.',
      );
    }

    if (readingTypeColMap.size === 0) {
      throw new Error400(
        'Tidak ada kolom Reading Type yang cocok dengan skema energi ini pada berkas import.',
      );
    }

    const errors: ImportErrorDetail[] = [];
    let successCount = 0;
    let totalRowsProcessed = 0;

    // ----------------------------------------------------
    // 2. Loop & Process Data Rows (Row 2 onwards)
    // ----------------------------------------------------
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      const rawMeterCode = String(row.getCell(meterCodeColIdx).value ?? '').trim();
      const rawDateVal = row.getCell(dateColIdx).value;

      // Skip empty or instructions rows
      if (!rawMeterCode && !rawDateVal) continue;
      if (rawMeterCode.toLowerCase().includes('contoh') || rawMeterCode.toLowerCase().includes('format')) {
        continue;
      }

      totalRowsProcessed++;

      const dateStr = rawDateVal instanceof Date ? rawDateVal.toISOString().split('T')[0] : String(rawDateVal ?? '').trim();

      // Validate Meter Code
      const meter = await prisma.meter.findUnique({
        where: { meter_code: rawMeterCode },
        include: { energy_type: true },
      });

      if (!meter) {
        errors.push({
          row: rowNum,
          meter_code: rawMeterCode,
          reading_date: dateStr,
          message: `Meteran dengan kode "${rawMeterCode}" tidak ditemukan di database.`,
        });
        continue;
      }

      if (meter.energy_type_id !== energyTypeId) {
        errors.push({
          row: rowNum,
          meter_code: rawMeterCode,
          reading_date: dateStr,
          message: `Meteran "${rawMeterCode}" bukan merupakan jenis energi ${energyType.name}.`,
        });
        continue;
      }

      if (meterId && meter.meter_id !== meterId) {
        errors.push({
          row: rowNum,
          meter_code: rawMeterCode,
          reading_date: dateStr,
          message: `Meteran "${rawMeterCode}" tidak sesuai dengan meteran spesifik yang dipilih pada opsi import.`,
        });
        continue;
      }

      // Validate Reading Date
      let parsedDate: Date | null = null;
      if (rawDateVal instanceof Date) {
        parsedDate = rawDateVal;
      } else if (typeof rawDateVal === 'object' && rawDateVal && 'result' in rawDateVal) {
        const resVal = (rawDateVal as any).result;
        parsedDate = resVal instanceof Date ? resVal : new Date(String(resVal));
      } else if (rawDateVal) {
        parsedDate = new Date(String(rawDateVal).trim());
      }

      if (!parsedDate || isNaN(parsedDate.getTime())) {
        errors.push({
          row: rowNum,
          meter_code: rawMeterCode,
          reading_date: dateStr,
          message: `Format tanggal "${dateStr}" tidak valid. Gunakan YYYY-MM-DD.`,
        });
        continue;
      }
      const dateForDb = _normalizeDate(parsedDate);

      // Extract Reading Details
      const details: { reading_type_id: number; value: number }[] = [];
      let rowHasValidDetail = true;

      for (const [colIdx, rtId] of readingTypeColMap.entries()) {
        const cellVal = row.getCell(colIdx).value;
        if (cellVal === null || cellVal === undefined || cellVal === '') continue;

        const numVal = typeof cellVal === 'number' ? cellVal : parseFloat(String(cellVal).replace(/,/g, ''));
        if (isNaN(numVal)) {
          errors.push({
            row: rowNum,
            meter_code: rawMeterCode,
            reading_date: dateStr,
            message: `Nilai angka tidak valid pada kolom pembacaan (Kolom ID:${rtId}).`,
          });
          rowHasValidDetail = false;
          break;
        }

        details.push({
          reading_type_id: rtId,
          value: numVal,
        });
      }

      if (!rowHasValidDetail) continue;

      if (details.length === 0) {
        errors.push({
          row: rowNum,
          meter_code: rawMeterCode,
          reading_date: dateStr,
          message: 'Baris ini tidak memiliki nilai angka pembacaan meteran.',
        });
        continue;
      }

      // Notes & Evidence
      const notes = notesColIdx > 0 ? String(row.getCell(notesColIdx).value ?? '').trim() : null;
      const evidenceUrl = imageColIdx > 0 ? String(row.getCell(imageColIdx).value ?? '').trim() : null;

      // Execute Save & Formula Calculation in DB Transaction
      try {
        await prisma.$transaction(async (tx) => {
          // Validate readings against meter config rules (thresholds, negative, rollover)
          const validMeter = await _validateMeter(meter.meter_id, tx);
          await readingValidator.validate(validMeter, dateForDb, details, tx);

          // Find existing session if re-importing/overwriting
          const existingSession = await tx.readingSession.findFirst({
            where: {
              meter_id: meter.meter_id,
              reading_date: {
                gte: startOfDay(dateForDb),
                lte: endOfDay(dateForDb),
              },
            },
          });

          let session;
          if (existingSession) {
            // Update existing session details
            await tx.readingDetail.deleteMany({
              where: { session_id: existingSession.session_id },
            });

            session = await tx.readingSession.update({
              where: { session_id: existingSession.session_id },
              data: {
                captured_by_user_id: userId,
                notes: notes || existingSession.notes,
                evidence_image_url: evidenceUrl || existingSession.evidence_image_url,
                details: {
                  create: details.map((d) => ({
                    reading_type_id: d.reading_type_id,
                    value: d.value,
                  })),
                },
              },
              include: { details: { include: { reading_type: true } } },
            });
          } else {
            // Create new session
            session = await tx.readingSession.create({
              data: {
                meter_id: meter.meter_id,
                reading_date: dateForDb,
                captured_by_user_id: userId,
                notes,
                evidence_image_url: evidenceUrl,
                details: {
                  create: details.map((d) => ({
                    reading_type_id: d.reading_type_id,
                    value: d.value,
                  })),
                },
              },
              include: { details: { include: { reading_type: true } } },
            });
          }

          // Audit Log
          await tx.auditLog.create({
            data: {
              user_id: userId,
              action: existingSession ? 'UPDATE' : 'CREATE',
              entity_table: 'ReadingSession',
              entity_id: String(session.session_id),
              old_values: existingSession ? (existingSession as any) : Prisma.DbNull,
              new_values: {
                session_id: session.session_id,
                meter_id: session.meter_id,
                meter_code: meter.meter_code,
                reading_date: session.reading_date,
                notes: session.notes,
                imported_via: 'DYNAMIC_EXCEL_IMPORT',
              } as any,
              reason: `Import massal data meteran ${meter.name} (${meter.meter_code}) via file spreadsheet`,
            },
          });

          // Run Formula Calculation Engine for this session
          await formulaEngine.run(meter.meter_id, dateForDb, tx);
        });

        successCount++;
      } catch (err: any) {
        errors.push({
          row: rowNum,
          meter_code: rawMeterCode,
          reading_date: dateStr,
          message: err.message || 'Gagal menyimpan dan menghitung data baris ini.',
        });
      }
    }

    return {
      total_rows: totalRowsProcessed,
      success_count: successCount,
      failed_count: errors.length,
      errors,
    };
  },
};
