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
# 例:
./scripts/upload_logs.sh "audit-log-gekal-123456789012-ap-northeast-1"
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

## ローカルデバッグ (Floci)

[Floci](https://github.com/floci-io/floci) (AWS ローカルエミュレータ) を使い、AWS にデプロイせずにローカルで Athena を起動してデバッグできます。

### 接続切り替えの仕組み

backend は Spring プロファイルで接続先を切り替えます。

| 環境               | プロファイル | 接続先                             |
| ------------------ | ------------ | ---------------------------------- |
| IDE デバッグ       | `local`      | Floci (`http://localhost:4566`)    |
| Docker Compose     | `local`      | Floci (`http://floci:4566`)        |
| ECS / 本番         | (未指定)     | 実 AWS                             |

`application-local.yaml` で Floci 用の設定 (`aws.endpoint-url`, バケット名等) を定義しています。`local` プロファイル未指定時は `application.yaml` の `aws.endpoint-url=` (空) が使われ、AWS SDK は実 AWS に接続します。

### 1. Floci の起動

リポジトリルート (`athena-query-example/`) で実行します。

```bash
docker compose up -d floci
```

Floci は `http://localhost:4566` で AWS API 互換のエンドポイントを公開します。

> **floci-duck サイドカー構成について**: Athena は内部で `floci-duck` (DuckDB) サイドカーが S3 上のデータを SQL 評価します。Floci がデフォルトで自動起動する floci-duck は、初回クエリ時に `httpfs` 拡張機能を `extensions.duckdb.org` からダウンロードしますが、ネットワーク環境によっては失敗します。
>
> このため `compose.yaml` では floci-duck を **手動管理** し、起動前に `floci-duck-init` で `httpfs.duckdb_extension` を Docker volume (`floci-duck-ext`) にキャッシュしてから `floci-duck` にマウントしています。Floci には `FLOCI_SERVICES_ATHENA_DUCK_URL=http://floci-duck:3000` を渡し、内部での container 起動をスキップさせます。
>
> `docker compose up -d floci` で `floci-duck-init` → `floci-duck` → `floci` の順に起動されます。

> **`FLOCI_HOSTNAME` の設定について**: Floci はデフォルトでレスポンス URL に `localhost.floci.io` を埋め込みます。これは 127.0.0.1 に解決される DNS ですが、Docker ネットワーク内の floci-duck コンテナからは到達できません (自コンテナを指すため S3 取得が `Could not resolve hostname` で失敗)。
>
> `compose.yaml` の floci サービスに `FLOCI_HOSTNAME: floci` を設定することで、Floci が S3 endpoint を `http://floci:4566` として埋め込み、同じネットワーク上の floci-duck から到達可能にしています。

### 2. Athena 環境のセットアップ

`infra-sdk/` で実行します。S3 バケット・Glue データベース/テーブル・Athena Workgroup を Floci 上に作成し、`data/` 配下のサンプルログをアップロードします。

```bash
cd infra-sdk
./scripts/floci-setup.sh
```

作成されるリソース:

| 種別           | 名前                                    |
| -------------- | --------------------------------------- |
| S3 バケット    | `audit-log-local`, `athena-results-local` |
| Glue Database  | `audit_log_db`                          |
| Glue Table     | `audit_logs`                            |
| Workgroup      | `AuditLogWorkGroup` (※下記参照)         |

> **Workgroup 作成のスキップについて**: Floci 1.5.11 時点では Athena の `CreateWorkGroup` API が未実装で、`InvalidAction` エラーが返ります。`floci-setup.sh` はこのエラーを検出した場合に soft-fail (警告を出して継続) する実装になっており、ローカルでは AWS デフォルトの primary workgroup でクエリが実行されます。バックエンドコードはワークグループを明示指定していないため、機能上の影響はありません。

### 3-A. IDE (IntelliJ IDEA など) からデバッグ

backend の Run/Debug Configuration に以下を設定:

- **Active profiles**: `local`
- (もしくは環境変数 `SPRING_PROFILES_ACTIVE=local`)

これだけで `application-local.yaml` が読み込まれ、AthenaClient / S3Presigner が `http://localhost:4566` の Floci に接続します。クレデンシャルは自動で `test/test` (静的) が使われるため、AWS CLI 設定や `~/.aws/credentials` への依存はありません。

### 3-B. Docker Compose で起動

`compose.yaml` の `backend` は `SPRING_PROFILES_ACTIVE=local` + `AWS_ENDPOINT_URL=http://floci:4566` で Floci に向くよう設定済みです。

```bash
docker compose up -d backend frontend
```

- API: `http://localhost:8080`
- UI : `http://localhost:3001`

### 4. AWS CLI からの動作確認

```bash
aws --endpoint-url http://localhost:4566 athena list-work-groups
aws --endpoint-url http://localhost:4566 s3 ls s3://audit-log-local/logs/
```

### Floci 1.5.11 の制約と SQL 構築方針

Floci 1.5.11 の floci-duck サイドカーは Glue データベースに対応する DuckDB スキーマを作成せず、ビューを **デフォルトスキーマ (`main`)** に作成します。たとえば setup SQL は以下のようになります。

```sql
CREATE OR REPLACE VIEW "audit_logs" AS SELECT * FROM read_json_auto('s3://audit-log-local/logs/**');
```

このため、SQL 内で `audit_log_db.audit_logs` のようにデータベースで修飾すると `schema "audit_log_db" does not exist` エラーになります。

**対応**: `AthenaController` は SQL を **テーブル名のみ** (`FROM audit_logs`) で構築します。`AthenaQueryClient.submitQuery()` で `QueryExecutionContext.database(databaseName)` を設定しているため、

- ローカル (Floci): `main.audit_logs` ビューに直接マッチして成功
- 本番 (AWS Athena): `QueryExecutionContext` のデフォルトデータベースが適用され `audit_log_db.audit_logs` として解決

の両方で同一の SQL が動作します。

### 環境変数の上書き

`floci-setup.sh` は以下の環境変数で挙動を変更できます。

| 変数                    | デフォルト                |
| ----------------------- | ------------------------- |
| `FLOCI_ENDPOINT_URL`    | `http://localhost:4566`   |
| `FLOCI_REGION`          | `ap-northeast-1`          |
| `FLOCI_AUDIT_BUCKET`    | `audit-log-local`         |
| `FLOCI_RESULT_BUCKET`   | `athena-results-local`    |
| `FLOCI_DATABASE`        | `audit_log_db`            |
| `FLOCI_TABLE`           | `audit_logs`              |
| `FLOCI_WORKGROUP`       | `AuditLogWorkGroup`       |
| `FLOCI_DATA_DIR`        | `data`                    |

## 開発用コマンド

### コードのフォーマット

Prettier を使用してコードのフォーマットを整形・チェックします。

```bash
# フォーマットの実行
npm run format

# フォーマットのチェック
npm run format:check
```
