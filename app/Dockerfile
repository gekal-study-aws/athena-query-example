# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Build the application
# Java 25対応のGradleイメージを使用（存在しない場合は nightly/ea を指定）
# -----------------------------------------------------------------------------
FROM gradle:9.2-jdk25 AS builder
WORKDIR /app

# キャッシュ効率化のため、先に依存関係定義だけをコピー
COPY build.gradle settings.gradle ./
# ソースコードをコピー
COPY src ./src

# テストをスキップしてビルド (CI/CD等の要件に合わせて調整してください)
RUN gradle bootJar -x test --no-daemon

# -----------------------------------------------------------------------------
# Stage 2: Extract Layers
# Spring Bootのlayertoolsモードを使用してJARを展開
# -----------------------------------------------------------------------------
FROM eclipse-temurin:25-jdk AS extractor
WORKDIR /builder

# Stage 1で作成されたJARを取得
COPY --from=builder /app/build/libs/*.jar app.jar

# JARを展開 (dependencies, spring-boot-loader, snapshot-dependencies, application)
RUN java -Djarmode=tools -jar app.jar extract --layers --launcher

# -----------------------------------------------------------------------------
# Stage 3: Runtime Image
# 実行に必要な最小限のJREを使用
# -----------------------------------------------------------------------------
FROM eclipse-temurin:25-jre
WORKDIR /app

# 変更頻度の低いものから順に記述することで、Dockerのレイヤーキャッシュを最大化
COPY --from=extractor /builder/app/dependencies/ ./
COPY --from=extractor /builder/app/spring-boot-loader/ ./
COPY --from=extractor /builder/app/snapshot-dependencies/ ./
COPY --from=extractor /builder/app/application/ ./

ENV JAVA_OPTS=""

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
