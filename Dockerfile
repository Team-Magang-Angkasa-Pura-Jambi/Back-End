# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache openssl libc6-compat

# 1. Setup Dependencies
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm install

# 2. Copy Source Code
COPY . .

# 3. Generate Prisma Client
# Asumsi: Schema Anda memiliki output = "../src/generated/prisma"
RUN npx prisma generate

# 4. Build TypeScript
# Ini akan membuat folder dist/src/... tapi TANPA runtime prisma
RUN npm run build

# 5. Prune
RUN npm prune --omit=dev


# ==========================================
# STAGE 2: Production
# ==========================================
FROM node:20-alpine

WORKDIR /usr/src/app

# Install System Deps
RUN apk add --no-cache openssl libc6-compat

# 1. Copy Node Modules
COPY --from=builder /usr/src/app/node_modules ./node_modules

# 2. Copy Hasil Build JS (Aplikasi Anda)
COPY --from=builder /usr/src/app/dist ./dist

# 3. FIX CRITICAL: Copy Manual Generated Prisma Assets
# Kita timpa folder generated di dalam dist dengan yang asli dari source.
# Ini memastikan folder 'runtime' dan file binary ikut terbawa ke tempat yang benar.
COPY --from=builder /usr/src/app/src/generated ./dist/src/generated

# 4. Copy Schema (Opsional, tapi bagus untuk debug)
COPY --from=builder /usr/src/app/prisma ./prisma

COPY --from=builder /usr/src/app/package.json ./package.json

EXPOSE 3000

CMD [ "node", "dist/index.js" ]