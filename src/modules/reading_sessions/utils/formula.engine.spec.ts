import { describe, it, expect } from 'vitest';
import { Parser } from 'expr-eval';

describe('Formula Engine - BBM Calculations (Pengukuran Stok Genset 05 Agustus 2026)', () => {
  const parser = new Parser();

  it('should calculate Ground tank 800 kVA (Cadangan) correctly', () => {
    // Gambar ref:
    // (9 cm : 174 cm) * 10000 liter = 517,24 liter
    // Daily tank = 1490 liter
    // Pemakaian 141 L / jam
    // Total 517 + 1490 = 2007 liter
    // Durasi full load: 2007/ 141 = 14 jam

    const rawFormulaTotal = '((TINGGI_AKTUAL / TINGGI_MAKSIMAL) * KAPASITAS) + DAILY_TANK';
    const scopeTotal = {
      TINGGI_AKTUAL: 9,
      TINGGI_MAKSIMAL: 174,
      KAPASITAS: 10000,
      DAILY_TANK: 1490,
    };
    
    const totalLiter = parser.evaluate(rawFormulaTotal, scopeTotal);
    // 9 / 174 * 10000 = 517.2413...
    // 517.24 + 1490 = 2007.24
    expect(totalLiter).toBeCloseTo(2007.24, 2);

    const rawFormulaDurasi = 'TOTAL_LITER / PEMAKAIAN_PER_JAM';
    const scopeDurasi = {
      // Di gambar, 517.24 dibulatkan jadi 517 sehingga total 2007
      TOTAL_LITER: Math.floor(totalLiter), 
      PEMAKAIAN_PER_JAM: 141,
    };

    const durasi = parser.evaluate(rawFormulaDurasi, scopeDurasi);
    
    // 2007 / 141 = 14.234... jam
    expect(durasi).toBeCloseTo(14.23, 2);
    // Pembulatan ke bawah sesuai gambar "14 jam"
    expect(Math.floor(durasi)).toBe(14); 
  });

  it('should calculate Ground tank 1700 kVA (Utama) correctly', () => {
    // Gambar ref:
    // (33 cm : 231 cm) * 20000 liter = 2857 liter
    // Daily tank = 1650 liter
    // Pemakaian 275 L / Jam
    // Total 2857 + 1650 = 4507 liter
    // Durasi: 4507 / 275 = 16 jam

    const rawFormulaTotal = '((TINGGI_AKTUAL / TINGGI_MAKSIMAL) * KAPASITAS) + DAILY_TANK';
    const scopeTotal = {
      TINGGI_AKTUAL: 33,
      TINGGI_MAKSIMAL: 231,
      KAPASITAS: 20000,
      DAILY_TANK: 1650,
    };
    
    const totalLiter = parser.evaluate(rawFormulaTotal, scopeTotal);
    // 33 / 231 * 20000 = 2857.1428...
    // 2857.14 + 1650 = 4507.14
    expect(totalLiter).toBeCloseTo(4507.14, 2);

    const rawFormulaDurasi = 'TOTAL_LITER / PEMAKAIAN_PER_JAM';
    const scopeDurasi = {
      // Di gambar, 2857.14 dibulatkan jadi 2857 sehingga total 4507
      TOTAL_LITER: Math.floor(totalLiter), 
      PEMAKAIAN_PER_JAM: 275,
    };

    const durasi = parser.evaluate(rawFormulaDurasi, scopeDurasi);
    
    // 4507 / 275 = 16.389... jam
    expect(durasi).toBeCloseTo(16.39, 2);
    // Pembulatan ke bawah sesuai gambar "16 jam"
    expect(Math.floor(durasi)).toBe(16);
  });
});
