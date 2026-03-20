# 監査ログ検索用 Athena 環境構築プロジェクト

このプロジェクトは、Amazon S3 に保存された監査ログ（JSON形式）を Amazon Athena で効率的に検索するためのインフラ環境を構築します。
CDK (Infrastructure as Code) を使用して環境を構築します。

## プロジェクトの特徴

- **パーティショニング**: ログを `year=YYYY/month=MM/day=DD/` 形式で管理し、Athena のスキャンコストを最適化。
- **データ生成ツール**: テスト用の疑似監査ログを生成し、パーティション構造を維持したまま S3 へ同期するスクリプトを同梱。

## フォルダ構成

```text
infra-sdk/
├── bin/
│   └── infra-sdk.ts        # CDK エントリーポイント
├── lib/
│   └── infra-sdk-stack.ts  # CDK スタック定義 (S3, Glue, Athena)
├── scripts/
│   ├── generate_sample_logs.sh # 疑似ログ生成 (日付指定・パーティション対応)
│   └── upload_logs.sh          # S3へのデータ同期 (aws s3 sync)
├── data/                   # 生成されたサンプルログの保存先 (ローカル)
├── package.json
└── tsconfig.json
```

## 前提条件

- Node.js (v18以上推奨)
- AWS CLI セットアップ済み
- AWS CDK CLI (`npm install -g aws-cdk`)

## 構築手順

最初に依存関係をインストールします。

```bash
cd infra-sdk
npm install
```

### AWS CDK によるデプロイ

AWS CDK を使用した標準的な IaC 手順です。

```bash
# 初回のみ必要: CDK 実行環境のセットアップ
npx cdk bootstrap

# デプロイの実行
npx cdk deploy
```

デプロイ成功後、コンソールに出力される `InfraSdkStack.AuditLogBucketName` をメモしてください。

## データの投入

### 1. サンプルデータの生成

指定した日付のパーティションフォルダにログを生成します。

```bash
# デフォルト (今日の日付) で100件生成
./scripts/generate_sample_logs.sh 100

# 日付を指定して生成
./scripts/generate_sample_logs.sh 100 2026-01-01
./scripts/generate_sample_logs.sh 100 2026-01-02
```

※現在、`infra-sdk/data/year=2026/month=01/day=01~07/` には各日100件、ユーザーIDが `user_001`〜`user_020` 形式のテストデータが同梱されています。

### 2. S3へのアップロード

ローカルの `data/` フォルダを S3 バケットへ同期します。

```bash
# <BucketName> は構築時に出力されたバケット名
./scripts/upload_logs.sh <BucketName>
./scripts/upload_logs.sh "audit-log-gekal-ap-northeast-1"
```

## Athena での確認

### 1. パーティションの認識 (Partition Projection)

本プロジェクトでは **Partition Projection** を採用しているため、データをアップロードするだけで即座に Athena で検索可能です。手動での `MSCK REPAIR TABLE` は不要です。

万が一パーティションが認識されない場合は、以下を実行してください。

```sql
MSCK REPAIR TABLE audit_log_db.audit_logs;
```

### 2. クエリの実行例

特定の日のログのみをスキャンするため、高速かつ安価に検索できます。

```sql
SELECT *
FROM audit_log_db.audit_logs
WHERE year = '2026' AND month = '01' AND day = '01'
LIMIT 10;
```

## リソースの削除

```bash
npx cdk destroy
```

## 開発用コマンド

### コードのフォーマット

Prettier を使用してコードのフォーマットを整形・チェックします。

```bash
# フォーマットの実行
npm run format

# フォーマットのチェック
npm run format:check
```
