# Cetak Biru (Blueprint) Modul Kalkulasi Multiplier Harga - Sentinel V2 Back-End

Dokumen spesifikasi teknis dan cetak biru arsitektur ini disusun sebagai pemenuhan fungsi **to-spec** untuk modul kalkulasi multiplier harga pada sistem Back-End Sentinel V2. Dokumen ini mendefinisikan batasan logika, pencegahan konflik relasi, validasi rentang multiplier menggunakan Zod, mitigasi risiko kegagalan matematis, serta skenario pengujian (UAT) berbasis sampling terstruktur.

---

## Problem Statement

Sistem Sentinel V2 saat ini mencatat konsumsi energi (listrik, air, bahan bakar) melalui perangkat meteran fisik maupun virtual. Dalam proses penagihan (*billing*), nilai pembacaan meteran mentah tidak dapat langsung dikalikan dengan tarif dasar skema harga karena beberapa alasan utama:
1. **Faktor Skala Alat (Multiplier Perangkat):** Setiap meteran memiliki spesifikasi rasio trafo arus (CT/PT) atau faktor pengali mekanis (*multiplier*) yang bervariasi (misalnya `1.0`, `10.0`, `1000.0`). Kesalahan input multiplier atau tidak divalidasinya nilai ini dapat mengakibatkan lonjakan nilai tagihan hingga ribuan kali lipat secara tidak sah.
2. **Potensi Konflik Logika Relasi:** Tidak ada batasan ketat yang menyelaraskan antara kategori penyewa (*Tenant Category*: Airline, Retail, Office), jenis energi (*Energy Type*: Electricity, Water, Fuel), dan skema harga (*Price Scheme*). Sebagai contoh, penyewa Retail tidak boleh dikenakan skema tarif penerbangan (Airline), dan meteran air tidak boleh dihitung menggunakan tarif listrik.
3. **Kerentanan Kegagalan Perhitungan Matematis:** Masalah presisi desimal mengambang (*floating point inaccuracy*), pembagian dengan nol, pembacaan mundur (*negative usage* akibat rollover), nilai `null`, atau skema harga yang tidak aktif/kedaluwarsa sering kali menyebabkan kalkulator tagihan harian (*daily summary engine*) macet atau menghasilkan data tidak valid.

---

## Solution
  
Kami merancang dan menerapkan **Modul Kalkulasi Multiplier Harga** yang kokoh, aman secara tipe (*Type-Safe*), dan konsisten. Solusi ini mencakup:
1. **Validasi Skema Zod Dinamis:** Mengunci perhitungan rentang multiplier secara deklaratif berdasarkan jenis energi (*Energy Type*) dan klasifikasi meteran guna menghindari anomali input data.
2. **Pencegahan Konflik Relasi (Logika Hubungan):** Aturan validasi silang (*cross-validation*) sebelum proses kalkulasi untuk memastikan kompatibilitas kategori tenant, meteran, dan skema harga.
3. **Billing Calculation Engine yang Tangguh:** Mesin komputasi berbasis `Decimal.js` yang memitigasi kegagalan pembagian dengan nol, menangani rollover meteran secara otomatis, dan melakukan pembulatan presisi tinggi sesuai standar akuntansi keuangan.
4. **Audit Trail Komprehensif:** Menyimpan log lengkap atas setiap parameter pengali dan keputusan kalkulasi harga untuk transparansi penagihan.

---

## User Stories

Berikut adalah daftar komprehensif skenario pengguna (User Stories) untuk modul ini:

1. **Sebagai Administrator Sistem**, saya ingin mengunci rentang batas multiplier meteran listrik antara `1.0000` hingga `2000.0000` menggunakan validasi Zod, agar tidak terjadi kesalahan input operasional dari teknisi di lapangan.
2. **Sebagai Administrator Sistem**, saya ingin membatasi multiplier meteran air maksimal hanya sampai `10.0000`, sehingga data pembacaan air tidak mengalami distorsi akibat salah unit (liter vs meter kubik).
3. **Sebagai Manajer Keuangan (Billing Manager)**, saya ingin sistem secara otomatis menolak pengaitan skema harga tipe "Electricity" ke meteran dengan tipe energi "Water", sehingga tidak terjadi kesalahan pengenaan tarif dasar.
4. **Sebagai Manajer Keuangan**, saya ingin sistem memvalidasi bahwa tenant dengan kategori "Retail" hanya dapat dikaitkan dengan skema harga yang diklasifikasikan untuk "Retail", sehingga keadilan tarif antar-sektor terjaga.
5. **As an Automated Billing Engine**, I want to load the correct active price scheme based on the exact reading date and effective date, so that rate adjustments are applied seamlessly on their scheduled launch.
6. **As an Automated Billing Engine**, I want to identify and flag reading sessions that show negative usage (when current reading is less than previous reading) and automatically apply rollover limit checks, so that the billing cost calculation does not produce negative amounts.
7. **As an Automated Billing Engine**, I want to compute all money transactions using high-precision Decimal math, so that I can prevent floating-point rounding errors (like `0.1 + 0.2 = 0.30000000000000004`) from affecting financial summaries.
8. **Sebagai Auditor Eksternal**, saya ingin melacak riwayat perubahan nilai multiplier pada setiap meteran melalui log audit (*audit_logs*), agar saya dapat memverifikasi keabsahan penyesuaian tagihan historis.
9. **Sebagai Teknisi Lapangan**, saya ingin mendapatkan notifikasi kesalahan yang jelas jika saya mencoba memasukkan nilai multiplier di luar batas toleransi kategori energi tersebut saat melakukan konfigurasi meter baru.

---

## Implementation Decisions

### 1. Arsitektur Komponen dan Validasi Zod

Modul ini akan diintegrasikan sebagai bagian dari `src/modules/price_schemes` dan penambahan kalkulator utilitas di `src/utils/calculator.ts` atau `src/modules/billing/`. 

Kami menggunakan Zod untuk mendefinisikan batasan pengali yang ketat berdasarkan jenis energi. Berikut adalah draf skema validasi tipe data (Zod) untuk mengunci kalkulasi rentang multiplier:

```typescript
import { z } from 'zod';

// Batasan konstanta multiplier untuk masing-masing kategori energi
export const ENERGY_MULTIPLIER_BOUNDS = {
  ELECTRICITY: { min: 1.0, max: 2000.0, step: 0.0001 },
  WATER: { min: 1.0, max: 50.0, step: 0.01 },
  FUEL: { min: 1.0, max: 10.0, step: 0.1 },
} as const;

// Skema Zod Dinamis untuk Multiplier berdasarkan Kategori Energi
export const priceMultiplierSchema = z.object({
  energy_type_name: z.enum(['Electricity', 'Water', 'Fuel']),
  multiplier: z.coerce.number()
}).superRefine((data, ctx) => {
  const name = data.energy_type_name.toUpperCase() as keyof typeof ENERGY_MULTIPLIER_BOUNDS;
  const bounds = ENERGY_MULTIPLIER_BOUNDS[name];

  if (!bounds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Kategori energi ${data.energy_type_name} tidak memiliki definisi batasan multiplier`,
      path: ['multiplier']
    });
    return;
  }

  if (data.multiplier < bounds.min || data.multiplier > bounds.max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Multiplier untuk ${data.energy_type_name} wajib berada di rentang [${bounds.min} - ${bounds.max}]`,
      path: ['multiplier']
    });
  }
});
```

### 2. Logika Pencegahan Konflik Relasi (Business Rules Integration)

Sebelum kalkulasi tagihan harian berjalan di `DailySummary` generator, sistem wajib memvalidasi kecocokan relasi entitas berikut:

```
  +--------------+               +-------------+               +-----------------+
  |    Tenant    |               |    Meter    |               |   PriceScheme   |
  +--------------+               +-------------+               +-----------------+
  | Category:    |               | Tenant ID   |               | Scheme ID       |
  | Retail/      |-------------->| PriceScheme |<--------------| Rate Value      |
  | Airline      |               | EnergyType  |               | ReadingType     |
  +--------------+               +-------------+               +-----------------+
         |                              |                               |
         |                              | (Must Match Energy)           |
         +------------------------------+-------------------------------+
                      Validation: Matches Category & Energy Type
```

1. **Aturan Validasi Kategori-Skema:**
   * Jika `tenant.category` adalah `Retail`, maka `price_scheme.name` atau klasifikasinya harus mengandung kata kunci `Retail` / dialokasikan untuk Retail.
   * Jika `tenant.category` adalah `Airline`, maka `price_scheme` harus bertipe aviasi/penerbangan.
2. **Aturan Validasi Tipe Energi:**
   * `meter.energy_type_id` harus memiliki `ReadingType` yang cocok dengan tarif di `scheme_rates.reading_type_id`.
   * Jika terdeteksi ketidakcocokan, kalkulator akan menghentikan proses kalkulasi, mencatat *warning log*, dan mengirimkan notifikasi kritis berkategori `ANOMALY_DETECTED` ke Admin.

### 3. Penanganan Potensi Kegagalan Perhitungan Matematis

Untuk memastikan keandalan komputasi keuangan, kami merancang mekanisme penanganan kegagalan (*fail-safe*) sebagai berikut:

| Potensi Kegagalan | Risiko Dampak | Strategi Mitigasi Keamanan |
| :--- | :--- | :--- |
| **Floating Point Precision** | Selisih nilai sen/rupiah pada laporan total cost harian. | Menggunakan pustaka desimal presisi tinggi (`Prisma.Decimal` atau `Decimal.js`) untuk semua operasi perkalian dan penjumlahan harga. |
| **Division by Zero** | Aplikasi crash (*uncaught exception*) saat menghitung biaya rata-rata per unit atau efisiensi penggunaan. | Melakukan pembungkusan (*wrapping*) fungsi pembagian dengan pengecekan: jika pembagi (*denominator*) adalah `0`, kembalikan nilai default `0.0000` secara aman. |
| **Rollover / Negative Usage** | Tagihan menjadi bernilai negatif yang merugikan perusahaan. | Jika pembacaan baru < pembacaan lama: periksa apakah `allow_decrease` aktif. Jika tidak aktif, hitung selisih berdasarkan `rollover_limit` meteran. Jika melebihi batas, tandai sebagai anomali data untuk evaluasi manual. |
| **Skema Harga Inaktif / Hilang** | Total cost bernilai `null` atau `0`, menyebabkan hilangnya data billing. | Menerapkan skema pencarian mundur (*fallback scheme*). Jika skema harga aktif tidak ditemukan pada tanggal terkait, gunakan harga standar nasional (default baseline rate) dan buat notifikasi peringatan. |
| **Integer Overflow/Underflow** | Nilai angka terlalu besar hingga melampaui batas memori JS. | Menggunakan tipe data PostgreSQL `Numeric(19, 4)` untuk biaya keuangan dan validasi batas angka maksimum pada Zod sebelum disimpan di DB. |

---

## Testing Decisions

### 1. Prinsip Pengujian
* **Fokus pada Perilaku Eksternal:** Kami hanya menguji keakuratan hasil kalkulasi, penolakan input di luar batas, dan pencegahan konflik logika relasi. Detail internal query Prisma tidak akan diekspos dalam skenario pengujian.
* **Integrasi Seam Pengujian:** Pengujian akan difokuskan pada unit pengujian di `src/modules/billing/__tests__/` (atau lokasi pengujian layanan harga) dengan mengisolasi database menggunakan mock Prisma atau database transaksi uji (`vitest`).

### 2. Skenario Pengujian UAT menggunakan Sampling Terstruktur

Untuk memastikan validasi fitur sangat akurat tanpa perlu menguji seluruh basis data, kami menggunakan **Logika Sampling Terstruktur** dalam pemilihan responden pengujian:

#### Kriteria Pemilihan Responden Sampel (UAT):
1. **Representasi Sektor Usaha (Tenant Category):**
   * **Sampel A (Retail):** Memilih 3 tenant kategori Retail berskala besar (tenant restoran/duty-free) dengan konsumsi daya tinggi.
   * **Sampel B (Airline):** Memilih 2 maskapai penerbangan internasional (airline) yang mengonsumsi air dan listrik di area lounge VIP bandara.
   * **Sampel C (Office):** Memilih 2 kantor administratif internal Angkasa Pura (office) sebagai sampel pembanding tarif non-komersial.
2. **Kondisi Khusus Batasan Multiplier:**
   * **Sampel D (High-Voltage Meter):** 1 meteran listrik gardu induk bandara dengan multiplier `1000.0000` (untuk menguji batas atas).
   * **Sampel E (Standard Water Meter):** 1 meteran air gedung terminal dengan multiplier desimal `1.5000` (untuk menguji presisi desimal).
3. **Kontrol Negatif (Boundary Testing):**
   * **Sampel F (Anomali Kategori):** Mencoba mengaitkan tenant Retail ke skema harga Airline. Sistem harus mendeteksi konflik logika secara instan dan menolaknya.

---

## Out of Scope

1. **Integrasi Payment Gateway:** Modul ini hanya melakukan kalkulasi nominal tagihan di Back-End dan tidak menangani proses transaksi pembayaran digital (*e-payment*), integrasi bank, atau penerbitan faktur pajak fisik (*e-faktur*).
2. **Sinkronisasi IoT Real-time:** Pengumpulan data langsung dari hardware meteran pintar (*smart meters*) menggunakan protokol MQTT/LoRaWAN berada di luar cakupan modul kalkulasi ini. Pembacaan meteran dianggap sudah masuk ke database melalui ReadingSession API.

---

## Further Notes

* **Audit Trail Keamanan:** Setiap kali modifikasi nilai multiplier meteran dilakukan, entri log audit baru wajib dibuat pada tabel `audit_logs` dengan menyertakan nama administrator yang mengubah, nilai lama, nilai baru, serta alasan perubahan (*reason*).
* **Kepatuhan Standar Akuntansi:** Semua pembulatan harga akhir dihitung menggunakan kaidah *Bankers' Rounding* (pembulatan ke angka genap terdekat) demi mematuhi standar audit keuangan internasional.
