import ExcelJS from 'exceljs';
import prisma from '../../../configs/db.js';
import { Error400, Error404 } from '../../../utils/customError.js';

export const templateGeneratorService = {
  /**
   * Generates a dynamic Excel (.xlsx) template for meter readings based on energy type and optional specific meter.
   */
  generateReadingTemplate: async (energyTypeId: number, meterId?: number): Promise<Buffer> => {
    const energyType = await prisma.energyType.findUnique({
      where: { energy_type_id: energyTypeId },
      include: {
        reading_types: true,
        meters: {
          where: { status: 'ACTIVE' },
          include: {
            location: true,
            tenant: true,
            reading_configs: {
              where: { is_active: true },
              include: { reading_type: true },
            },
          },
        },
      },
    });

    if (!energyType) {
      throw new Error404(`Energy type dengan ID ${energyTypeId} tidak ditemukan.`);
    }

    let targetReadingTypes: { reading_type_id: number; type_name: string; unit: string }[] = [];
    let sampleMeterCode = 'MTR-001';
    let targetMeters = energyType.meters;

    if (meterId) {
      const selectedMeter = energyType.meters.find((m) => m.meter_id === meterId);
      if (!selectedMeter) {
        throw new Error404(`Meteran dengan ID ${meterId} tidak ditemukan untuk jenis energi ini.`);
      }
      sampleMeterCode = selectedMeter.meter_code;
      targetMeters = [selectedMeter];
      targetReadingTypes = selectedMeter.reading_configs
        .map((rc) => rc.reading_type)
        .filter(Boolean);

      if (targetReadingTypes.length === 0) {
        throw new Error400(
          `Meteran "${selectedMeter.meter_code}" belum memiliki konfigurasi Reading Type aktif.`,
        );
      }
    } else {
      targetReadingTypes = energyType.reading_types;
      if (energyType.meters.length > 0) {
        sampleMeterCode = energyType.meters[0].meter_code;
      }
    }

    if (targetReadingTypes.length === 0) {
      throw new Error400(`Jenis energi ${energyType.name} belum memiliki Reading Type terdaftar.`);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sentinel V2 System';
    workbook.lastModifiedBy = 'Sentinel V2 System';
    workbook.created = new Date();

    const sheetName =
      meterId && targetMeters[0] ? `Import ${targetMeters[0].meter_code}` : `Import ${energyType.name}`;
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    // Base Headers
    const headers = ['Kode Meter', 'Tanggal Catat (YYYY-MM-DD)'];

    // Dynamic Headers per Reading Type
    targetReadingTypes.forEach((rt) => {
      headers.push(`${rt.type_name} (${rt.unit}) [ID:${rt.reading_type_id}]`);
    });

    const headerRow = sheet.addRow(headers);

    // Style Header Row
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' },
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
    headerRow.height = 28;

    // Example Guidance Row (Row 2)
    const sampleRowValues = [
      sampleMeterCode,
      '2026-09-01',
    ];

    targetReadingTypes.forEach(() => {
      sampleRowValues.push('100.00');
    });

    const sampleRow = sheet.addRow(sampleRowValues);
    sampleRow.eachCell((cell) => {
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        italic: true,
        color: { argb: 'FF64748B' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
    });

    // Auto-fit column widths
    sheet.columns.forEach((col) => {
      col.width = 28;
    });

    // Sheet 2: Reference Meters
    const refSheet = workbook.addWorksheet('Daftar Meteran (Referensi)', {
      views: [{ showGridLines: true }],
    });

    const refHeaders = ['Kode Meter', 'Nama Meter', 'Kategori', 'Lokasi', 'Tenant'];
    const refHeaderRow = refSheet.addRow(refHeaders);
    refHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' },
      };
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
    });

    targetMeters.forEach((m) => {
      refSheet.addRow([
        m.meter_code,
        m.name ?? '-',
        m.category,
        m.location?.name ?? '-',
        m.tenant?.name ?? '-',
      ]);
    });

    refSheet.columns.forEach((col) => {
      col.width = 24;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },
};
