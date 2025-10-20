# ---------- build ----------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm install

# Гарантируем, что папка public существует в builder (на случай, если её нет в контексте)
RUN mkdir -p public

COPY . .
# next.config.js содержит: output: 'standalone'
RUN npm run build

# ---------- run ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# Кладём standalone-сервер, который собрал Next
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public   # <--- вот эта строка обязательна


# Вместо обязательного COPY public — просто создадим её (если есть что копировать — не критично)
RUN mkdir -p ./public
# Если хочешь копировать, когда она реально есть — оставь строку ниже, но она уже не обязательна:
# COPY --from=builder /app/public ./public

EXPOSE 3000

# healthcheck (удобно для Portainer)
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -sf http://127.0.0.1:3000/health || exit 1

CMD ["node","server.js"]
