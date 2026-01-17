# --- STAGE 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install OpenSSL (Wajib untuk Prisma)
RUN apk add --no-cache openssl

# 1. Copy package.json DULU
COPY package*.json ./

# 2. PENTING: Copy folder prisma SEBELUM npm install
# Agar saat 'postinstall' jalan, dia bisa nemu schema.prisma
COPY prisma ./prisma

# 3. Baru install (Postinstall 'prisma generate' akan sukses di sini)
RUN npm install

# 4. Copy sisa codingan
COPY . .

# 5. Build TypeScript
RUN npm run build

# --- STAGE 2: Production ---
FROM node:20-alpine

WORKDIR /usr/src/app

# Install OpenSSL untuk production
RUN apk add --no-cache openssl

# 1. Copy package.json
COPY package*.json ./

# 2. Copy folder prisma DULU (sama alasannya)
COPY --from=builder /usr/src/app/prisma ./prisma

# 3. Install dependencies production saja
# (Otomatis menjalankan prisma generate lagi untuk environment prod)
RUN npm install --omit=dev

# 4. Copy hasil build JS dari stage builder
COPY --from=builder /usr/src/app/dist ./dist

# Ekspos port
EXPOSE 3000

CMD [ "node", "dist/src/index.js" ]