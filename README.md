## リポジトリ概要

このリポジトリは、**Amazon Athena で AWS 監査ログを効率的に検索するための環境を構築するプロジェクト** です。

### 📋 プロジェクト構成

**3つのコンポーネント**で構成されています：

#### 1. **infra-sdk/** - インフラストラクチャ環境構築
- **AWS CDK (TypeScript)** でインフラリソースを定義・デプロイ
- **AWS SDK** による直接構築も可能
- 以下のAWSサービスを自動構築：
  - **S3**: パーティション化された監査ログストレージ
  - **Glue**: メタデータカタログ
  - **Athena**: SQL検索エンジン

#### 2. **backend/** - Spring Boot アプリケーション
- **Spring Boot 4.0.1** ベースの REST API
- AWS SDK を使用した Athena クエリ実行・ステータス確認・結果取得
- サーバーサイドページネーション対応
- Java 25 対応

#### 3. **frontend/** - Next.js アプリケーション
- **Next.js (App Router)** + **MUI (Material UI)**
- **TanStack Query (React Query)** による非同期データ取得
- Athena 検索結果のサーバーサイドページネーション表示
- 大容量データのストリーミング CSV ダウンロード機能

### 🎯 使用技術
- **フロントエンド**: Next.js, MUI, TanStack Query
- **バックエンド**: Java (Spring Boot), TypeScript (AWS CDK, AWS SDK)
- **インフラ**: AWS (S3, Glue, Athena)
- **ビルド**: Gradle (Java), npm (Node.js)
- **IaC**: AWS CDK

### 📁 典型的なワークフロー
1. `infra-sdk` で AWS リソースをデプロイ
2. `infra-sdk` のスクリプトでサンプルログを生成・S3 にアップロード
3. `backend` で REST API を起動
4. `frontend` で UI を起動し、ブラウザから検索・CSVダウンロードを実行