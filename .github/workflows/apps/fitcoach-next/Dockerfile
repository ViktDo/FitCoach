# ---------- build ----------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# 1) копируем package.json
COPY package*.json ./
# 2) ставим зависимости обычным install (lock-файла нет)
RUN npm install
# 3) копируем исходники
COPY . .
# 4) собираем Next (standalone в .next/standalone)
RUN npm run build

# ---------- run ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# ⚠️ Иногда Next/sharp на Alpine требует glibc-совместимости
RUN apk add --no-cache libc6-compat curl

# Кладём весь standalone-сервер
COPY --from=builder /app/.next/standalone ./
# Статика
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -sf http://127.0.0.1:3000/api/health || exit 1

# В .next/standalone уже есть server.js — ЕГО и запускаем
CMD ["node","server.js"]