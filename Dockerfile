# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache openssl libc6-compat

# 1. Setup Manifest & Config untuk Caching Docker
COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma

# Install all dependencies (termasuk devDeps untuk tsc & prisma CLI)
RUN npm install

# 2. Copy seluruh Source Code
COPY . .

# 3. Generate Prisma Client ke src/generated/prisma
RUN npx prisma generate

# 4. Build TypeScript (menghasilkan dist/src/...)
RUN npm run build

# 5. Buang devDependencies untuk merampingkan node_modules
RUN npm prune --omit=dev


# ==========================================
# STAGE 2: Production
# ==========================================
FROM node:20-alpine

WORKDIR /usr/src/app

# Install runtime system dependencies untuk Prisma engine
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production

# 1. Copy Production Dependencies
COPY --from=builder /usr/src/app/node_modules ./node_modules

# 2. Copy Compiled JavaScript
COPY --from=builder /usr/src/app/dist ./dist

# 3. Copy Prisma Generated Client ke dalam dist
COPY --from=builder /usr/src/app/src/generated ./dist/src/generated

# 4. Copy Prisma Schema & Package Info
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/package.json ./package.json

EXPOSE 3000

# Entry point production
CMD [ "node", "dist/src/index.js" ]