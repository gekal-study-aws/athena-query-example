# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Build the application
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# 依存関係定義をコピー
COPY package.json package-lock.json ./

# キャッシュを有効活用するため、依存関係のインストールをソースコピー前に行う
RUN npm ci

# ソースコードをコピー
COPY . .

# ビルド実行
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Runtime Image
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Next.js の出力モードが standalone の場合を想定（現在はデフォルト）
# もし next.config.ts で output: 'standalone' を設定していない場合は、
# ここで全てのファイルをコピーするか、standalone 設定を追加する必要があります。

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
