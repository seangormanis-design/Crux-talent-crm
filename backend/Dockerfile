FROM node:20-alpine

# Alpine ships OpenSSL 3.x by default; Prisma's engine binaries need this
# installed explicitly or they fail to detect libssl and crash at runtime.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 4000

CMD sh -c "npx prisma migrate deploy && npm start"
