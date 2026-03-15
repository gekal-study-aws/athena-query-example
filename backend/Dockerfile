# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Build the application
# Java 25対応のGradleイメージを使用
# -----------------------------------------------------------------------------
FROM gradle:9.2-jdk25 AS builder
WORKDIR /app

# Gradleの設定ファイルを先にコピーして依存関係をキャッシュ
COPY settings.gradle ./
COPY gradle/libs.versions.toml gradle/
COPY backend/build.gradle backend/

# 空のfrontendディレクトリを作成（settings.gradle で include 'frontend' と定義されているため）
RUN mkdir frontend

# 依存関係のみを解決（--no-daemonでビルドの安定性を高める）
RUN gradle :backend:dependencies --no-daemon

# ソースコードをコピー
COPY backend/src backend/src

# backend プロジェクトのみビルド
RUN gradle :backend:bootJar -x test --no-daemon

# -----------------------------------------------------------------------------
# Stage 2: Extract Layers
# Spring Bootのlayertoolsモードを使用してJARを展開
# -----------------------------------------------------------------------------
FROM eclipse-temurin:25-jdk AS extractor
WORKDIR /builder

# Stage 1で作成されたJARを取得
COPY --from=builder /app/backend/build/libs/*.jar app.jar

# JARを展開 (dependencies, spring-boot-loader, snapshot-dependencies, application)
RUN java -Djarmode=tools -jar app.jar extract --layers --destination extracted

# -----------------------------------------------------------------------------
# Stage 3: Runtime Image
# 実行に必要な最小限のJREを使用
# -----------------------------------------------------------------------------
FROM eclipse-temurin:25-jre
RUN useradd -m gradle
USER gradle
WORKDIR /app

# 変更頻度の低いものから順に記述することで、Dockerのレイヤーキャッシュを最大化
COPY --from=extractor /builder/extracted/dependencies/ ./
COPY --from=extractor /builder/extracted/spring-boot-loader/ ./
COPY --from=extractor /builder/extracted/snapshot-dependencies/ ./
COPY --from=extractor /builder/extracted/application/ ./

ENV JAVA_OPTS=""

ENTRYPOINT ["java", "-jar", "app.jar"]
