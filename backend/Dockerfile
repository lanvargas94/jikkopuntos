FROM node:20-bookworm-slim

# Prisma necesita OpenSSL para el schema/query engine (incluso con SQLite).
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/dev.db

EXPOSE 4000

ENV PORT=4000

CMD ["sh", "-c", "mkdir -p /data && npx prisma db push && node dist/src/main.js"]
