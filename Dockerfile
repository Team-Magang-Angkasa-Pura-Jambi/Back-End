# Gunakan base image Node.js yang sesuai dengan versi di log Anda
FROM node:20-alpine

# Tetapkan direktori kerja di dalam container
WORKDIR /usr/src/app

# Install OpenSSL yang mungkin dibutuhkan oleh Prisma
RUN apk add --no-cache openssl

# Salin file package.json, package-lock.json, dan skema Prisma SEBELUM install
COPY package*.json ./

COPY prisma ./prisma


RUN npm install

# Ekspos port aplikasi
EXPOSE 3000