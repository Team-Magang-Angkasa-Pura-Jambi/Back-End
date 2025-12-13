# 🛡️ Sentinel Backend Service

Selamat datang di repositori **Sentinel Backend**. Proyek ini merupakan layanan backend berbasis **Node.js** dan **TypeScript** yang dirancang untuk berinteraksi dengan layanan Machine Learning.

![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)
![Status](https://img.shields.io/badge/Status-Development-green)

## 📋 Daftar Isi

- [Tentang Proyek](#-tentang-proyek)
- [Arsitektur](#-arsitektur)
- [Prasyarat](#-prasyarat)
- [Instalasi & Menjalankan](#-instalasi--menjalankan)
- [Variabel Lingkungan](#-variabel-lingkungan)
- [Debugging](#-debugging)

## 📖 Tentang Proyek

Backend ini berfungsi sebagai API Gateway dan orkestrator utama yang menangani permintaan dari klien serta berkomunikasi dengan layanan prediksi ML (`ml-api`).

## 🏗 Arsitektur

Proyek ini menggunakan **Docker Compose** untuk mengorkestrasi layanan:

1. **backend-ts**: Aplikasi utama (Node.js/TypeScript) yang berjalan dalam mode development dengan _hot-reload_.
2. **ml-api**: Layanan Machine Learning pendukung (Python).

## 💻 Prasyarat

Sebelum memulai, pastikan Anda telah menginstal:

- Docker Desktop (termasuk Docker Compose)

## 🚀 Instalasi & Menjalankan

Anda tidak perlu menginstal Node.js atau Python secara lokal jika menggunakan Docker.

1. **Clone repositori ini** ke komputer lokal Anda.
2. **Jalankan aplikasi dengan Docker Compose**:

   ```bash
   docker-compose up --build
   ```

   Perintah ini akan:
   - Membangun image untuk `backend-ts` dan `ml-api`.
   - Menjalankan container dan melakukan _mounting_ volume untuk _live updates_.

3. **Akses Aplikasi**:
   - **API Backend**: Dapat diakses melalui host di `http://localhost:8080`.
   - **ML API**: Berjalan secara internal dan dapat diakses oleh backend di `http://ml-api:8000`.

## 🔧 Variabel Lingkungan

Konfigurasi environment utama telah diatur dalam `docker-compose.yml`:

| Key          | Value                | Keterangan                                                            |
| ------------ | -------------------- | --------------------------------------------------------------------- |
| `PORT`       | `8080`               | Port internal di dalam container backend (dipetakan ke 8080 di host). |
| `ML_API_URL` | `http://ml-api:8000` | URL internal untuk komunikasi ke service ML.                          |

## 🐞 Debugging

Service ini telah dikonfigurasi untuk mendukung debugging Node.js jarak jauh.

- **Port Debug**: `9229`
- Anda dapat menghubungkan debugger (seperti VS Code Inspector atau Chrome DevTools) ke `localhost:9229` saat container sedang berjalan.

---

Dibuat dengan ❤️ oleh Tim Sentinel.
