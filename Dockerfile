# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install OpenSSL (Wajib untuk Prisma)
RUN apk add --no-cache openssl libc6-compat

# 1. Copy package files
COPY package*.json ./

# 2. FIX UTAMA: Copy folder prisma SEBELUM npm install
# Ini agar script 'postinstall' prisma bisa menemukan schema.prisma
COPY prisma ./prisma

# 3. Install dependencies secara normal
# Script 'postinstall' (npx prisma generate) akan berjalan otomatis di sini
# dan karena folder prisma sudah ada, generate akan SUKSES.
RUN npm install

# 4. Copy sisa source code aplikasi
COPY . .

# 5. Build TypeScript
# Karena step 3 sudah sukses generate, error "no exported member" akan hilang.
RUN npm run build

# 6. Bersihkan devDependencies
RUN npm prune --omit=dev


# ==========================================
# STAGE 2: Production
# ==========================================
FROM node:20-alpine

WORKDIR /usr/src/app

# Install OpenSSL & libc6-compat (Wajib di runtime Alpine)
RUN apk add --no-cache openssl libc6-compat

# Copy node_modules bersih dari builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy hasil build JS
COPY --from=builder /usr/src/app/dist ./dist

# Copy folder prisma (untuk runtime schema access)
COPY --from=builder /usr/src/app/prisma ./prisma

COPY --from=builder /usr/src/app/package.json ./package.json

EXPOSE 3000

CMD [ "node", "dist/index.js" ]