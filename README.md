## リポジトリ概要

このリポジトリは、**Amazon Athena で AWS 監査ログを効率的に検索するための環境を構築するプロジェクト** です。

### 📋 プロジェクト構成

**2つのコンポーネント**で構成されています：

#### 1. **infra-sdk/** - インフラストラクチャ環境構築
- **AWS CDK (TypeScript)** でインフラリソースを定義・デプロイ
- **AWS SDK** による直接構築も可能
- 以下のAWSサービスを自動構築：
  - **S3**: パーティション化された監査ログストレージ
  - **AWS Glue**: メタデータカタログ
  - **Amazon Athena**: SQL検索エンジン

**特徴:**
- パーティショニング: `year=YYYY/month=MM/day=DD/` 形式で管理し、スキャンコストを最適化
- **Partition Projection**採用により手動修復不要
- サンプルデータ生成・S3アップロード用スクリプト搭載

#### 2. **app/** - Spring Boot アプリケーション
- **Spring Boot 4.0.1** ベースの REST API
- AWS SDK を使用した Athena クエリ実行機能
- S3 連携機能
- Java 25 対応

**依存関係:**
- AWS SDK (Athena, S3, SSO)
- Spring Web MVC
- Spotless (コード整形)

### 🎯 使用技術
- **バックエンド**: Java (Spring Boot), TypeScript (AWS CDK, AWS SDK)
- **インフラ**: AWS (S3, Glue, Athena)
- **ビルド**: Gradle (Java), npm (Node.js)
- **IaC**: AWS CDK

### 📁 典型的なワークフロー
1. infra-sdk で AWS リソースをデプロイ
2. スクリプトでサンプルログを生成・S3 にアップロード
3. app で REST API を実行し、Athena でログを検索