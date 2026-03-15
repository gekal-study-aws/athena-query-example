# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Install dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec1f27be0931072bc#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 依存関係定義をコピー
COPY package.json package-lock.json ./

# キャッシュを有効活用するため、依存関係のインストールをソースコピー前に行う
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Build the application
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# node_modules を deps ステージからコピー
COPY --from=deps /app/node_modules ./node_modules
# ソースコードをコピー
COPY . .

# ビルド実行
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Runtime Image
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

# nginx のデフォルト設定を削除
RUN rm -rf ./*

# ビルド成果物（out ディレクトリ）をコピー
COPY --from=builder /app/out ./

# nginx の設定ファイルを必要に応じて追加（SPA のルーティング対応など）
# 今回は Next.js の static export なので、必要最低限で
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri.html $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
