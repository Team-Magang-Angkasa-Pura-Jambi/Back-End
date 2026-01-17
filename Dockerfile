
FROM node:20-alpine AS builder

WORKDIR /usr/src/app


RUN apk add --no-cache openssl

COPY package*.json ./


RUN npm install

COPY . .


RUN npx prisma generate


RUN npm run build


FROM node:20-alpine

WORKDIR /usr/src/app


RUN apk add --no-cache openssl

COPY package*.json ./


RUN npm install --omit=dev


COPY --from=builder /usr/src/app/dist ./dist


COPY --from=builder /usr/src/app/prisma ./prisma



COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD [ "node", "dist/index.js" ]