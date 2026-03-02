


FROM node:20-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache openssl libc6-compat


COPY package*.json ./
COPY prisma ./prisma


RUN npm install


COPY . .



RUN npx prisma generate



RUN npm run build


RUN npm prune --omit=dev





FROM node:20-alpine

WORKDIR /usr/src/app


RUN apk add --no-cache openssl libc6-compat


COPY --from=builder /usr/src/app/node_modules ./node_modules


COPY --from=builder /usr/src/app/dist ./dist




COPY --from=builder /usr/src/app/src/generated ./dist/src/generated


COPY --from=builder /usr/src/app/prisma ./prisma

COPY --from=builder /usr/src/app/package.json ./package.json

EXPOSE 3000

CMD [ "node", "dist/src/index.js" ]