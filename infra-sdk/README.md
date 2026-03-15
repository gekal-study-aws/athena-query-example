# 監査ログ検索用 Athena 環境構築プロジェクト

このプロジェクトは、Amazon S3 に保存された監査ログ（JSON形式）を Amazon Athena で効率的に検索するためのインフラ環境を構築します。
CDK (Infrastructure as Code) と AWS SDK (TypeScript) の両方の手法で環境を構築することが可能です。

## プロジェクトの特徴

- **パーティショニング**: ログを `year=YYYY/month=MM/day=DD/` 形式で管理し、Athena のスキャンコストを最適化。
- **柔軟な構築**: AWS CDK によるデプロイと、プログラム (AWS SDK) からの直接構築の両方に対応。
- **データ生成ツール**: テスト用の疑似監査ログを生成し、パーティション構造を維持したまま S3 へ同期するスクリプトを同梱。

## フォルダ構成

```text
infra-sdk/
├── bin/
│   ├── infra-sdk.ts        # CDK エントリーポイント
│   └── setup-sdk.ts        # SDK 構築用エントリーポイント
├── lib/
│   └── infra-sdk-stack.ts  # CDK スタック定義 (S3, Glue, Athena)
├── src/
│   └── sdk/                # SDK 構築ロジックの本体
│       ├── clients.ts      # SDK クライアント初期化
│       └── setup-infra.ts  # インフラ構築関数
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

### 方法 1: AWS CDK によるデプロイ

AWS CDK を使用した標準的な IaC 手順です。

```bash
# 初回のみ必要: CDK 実行環境のセットアップ
npx cdk bootstrap

# デプロイの実行
npx cdk deploy
```

デプロイ成功後、コンソールに出力される `InfraSdkStack.AuditLogBucketName` をメモしてください。

### 方法 2: AWS SDK による構築

AWS SDK (TypeScript) を使用して、プログラムから直接リソースを作成します。

```bash
# AWSアカウントIDを環境変数に設定（自動取得の例）
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 構築スクリプトの実行
npm run setup-sdk
```

成功すると、作成されたバケット名やデータベース名が表示されます。

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

※CDK 以外（SDK等）で構築し Partition Projection が設定されていない場合は、以下を実行してください。

```sql
-- CDK で構築した場合
MSCK REPAIR TABLE audit_log_db.audit_logs;

-- SDK で構築した場合
MSCK REPAIR TABLE audit_log_db_sdk.audit_logs;
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

### CDK の場合
```bash
npx cdk destroy
```

### SDK の場合
S3 バケットや Glue データベースを手動で削除してください。
