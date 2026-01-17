# ==========================================
# STAGE 1: Builder (Membangun Aplikasi)
# ==========================================
FROM node:20-alpine AS builder

# Set direktori kerja standar
WORKDIR /usr/src/app

# Install OpenSSL (Wajib untuk Prisma Engine)
RUN apk add --no-cache openssl

# 1. Copy file dependensi
COPY package*.json ./

# 2. Copy folder Prisma (PENTING: Sebelum npm install)
# Agar script "postinstall": "prisma generate" bisa berjalan sukses
COPY prisma ./prisma

# 3. Install semua dependencies (termasuk devDependencies untuk build)
RUN npm install

# 4. Copy seluruh source code
COPY . .

# 5. Build TypeScript & Copy files (sesuai script build di package.json)
RUN npm run build

# ==========================================
# STAGE 2: Production (Image Siap Pakai)
# ==========================================
FROM node:20-alpine AS runner

# Set Environment ke Production
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Install OpenSSL lagi untuk production
RUN apk add --no-cache openssl

# 1. Copy package.json
COPY package*.json ./

# 2. Install dependencies Production saja
# --ignore-scripts: Mencegah 'prisma generate' jalan ulang (hemat waktu & error)
RUN npm install --omit=dev --ignore-scripts

# 3. Copy Schema Prisma (untuk validasi runtime)
COPY --from=builder /usr/src/app/prisma ./prisma

# 4. [SOLUSI PRISMA] Copy Engine Database yang sudah digenerate dari Builder
# Folder .prisma ini berisi engine binary yang sering hilang
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# 5. Copy hasil build TypeScript (folder dist)
COPY --from=builder /usr/src/app/dist ./dist

# 6. [KEAMANAN] Ubah user menjadi 'node' (bukan root)
RUN chown -R node:node /usr/src/app
USER node

# Expose port aplikasi
EXPOSE 3000

# Jalankan aplikasi
# Path disesuaikan dengan struktur: dist -> src -> index.js
CMD [ "node", "dist/src/index.js" ]