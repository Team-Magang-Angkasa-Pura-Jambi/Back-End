
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache openssl

COPY package*.json ./

COPY prisma ./prisma

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache openssl

COPY package*.json ./

COPY --from=builder /usr/src/app/prisma ./prisma

RUN npm install --omit=dev

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

RUN ls -R dist

CMD [ "node", "dist/src/index.js" ]