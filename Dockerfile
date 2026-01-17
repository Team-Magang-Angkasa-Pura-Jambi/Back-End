# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install OpenSSL (Wajib untuk Prisma)
RUN apk add --no-cache openssl libc6-compat

# 1. Copy package files
COPY package*.json ./

# 2. Install dependencies tapi LEWATI script postinstall
# Ini mencegah error "schema not found" karena folder prisma belum dicopy
RUN npm install --ignore-scripts

# 3. Copy source code (termasuk folder prisma)
COPY . .

# 4. Sekarang baru jalankan generate (karena file schema sudah ada)
RUN npx prisma generate

# 5. Build TypeScript
RUN npm run build

# 6. Bersihkan devDependencies untuk persiapan production
# Ini akan menghapus typescript, ts-node, dll dari node_modules
RUN npm prune --omit=dev


# ==========================================
# STAGE 2: Production
# ==========================================
FROM node:20-alpine

WORKDIR /usr/src/app

# Install OpenSSL (Wajib di runtime)
RUN apk add --no-cache openssl libc6-compat

# --- PENTING: Copy node_modules yang sudah bersih dari builder ---
# Kita TIDAK melakukan 'npm install' lagi di sini untuk menghindari error gyp/python
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy hasil build JS
COPY --from=builder /usr/src/app/dist ./dist

# Copy folder prisma (untuk akses schema jika diperlukan runtime)
COPY --from=builder /usr/src/app/prisma ./prisma

# Copy package.json (opsional, kadang dibutuhkan untuk membaca versi/script)
COPY --from=builder /usr/src/app/package.json ./package.json

EXPOSE 3000

CMD [ "node", "dist/index.js" ]