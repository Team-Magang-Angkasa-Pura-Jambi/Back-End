# --- STAGE 1: Build ---
# Tahap ini digunakan untuk meng-install semua dependensi (termasuk dev)
# dan membangun aplikasi TypeScript menjadi JavaScript.
FROM node:20-alpine AS builder

# Tetapkan direktori kerja
WORKDIR /usr/src/app

# Install OpenSSL yang dibutuhkan oleh Prisma
RUN apk add --no-cache openssl

# Salin file package.json dan package-lock.json
COPY package*.json ./

# Install semua dependensi. Skrip `postinstall` ("npx prisma generate") akan berjalan otomatis.
RUN npm install

# Salin sisa kode sumber aplikasi
COPY . .

# Jalankan skrip build dari package.json
RUN npm run build

# --- STAGE 2: Production ---
# Tahap ini membuat image final yang lebih ramping untuk produksi.
FROM node:20-alpine

WORKDIR /usr/src/app

# Salin package.json dan package-lock.json untuk menginstall dependensi produksi saja
COPY package*.json ./
RUN npm install --omit=dev

# Install OpenSSL yang dibutuhkan oleh Prisma di image produksi
RUN apk add --no-cache openssl

# Salin hasil build (folder 'dist') dan skema prisma dari tahap 'builder'
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Ekspos port yang digunakan aplikasi
EXPOSE 3000

# Perintah untuk menjalankan aplikasi dari file hasil build
CMD [ "node", "dist/index.js" ]