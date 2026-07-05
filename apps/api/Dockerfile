FROM node:24-alpine AS builder

WORKDIR /app

COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

COPY apps/api/tsconfig.json apps/api/prisma.config.ts ./
COPY apps/api/prisma/ prisma/
COPY apps/api/src/ src/

# prisma.config.ts resolves DATABASE_URL at load time; generate itself never
# connects, so a placeholder URL is enough here.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
  && npm run build

FROM node:24-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/prisma/ prisma/
COPY --from=builder /app/dist/ dist/

ENV NODE_ENV=production

EXPOSE 3000

# Apply migrations and idempotent seed before serving.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed.js && node dist/index.js"]
