FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
COPY assets ./assets/

RUN npm run build

FROM node:20-alpine AS runner

# curl for healthcheck; openssl for Prisma native engine
RUN apk add --no-cache openssl libssl3 curl

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/assets ./assets

# Regenerate Prisma client for the exact runtime environment (arm64-musl / x86-musl).
# This runs at BUILD TIME so internet is available and avoids download attempts at startup.
RUN ./node_modules/.bin/prisma generate

EXPOSE 4000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node -r ts-node/register prisma/seed.ts && node dist/index.js"]
