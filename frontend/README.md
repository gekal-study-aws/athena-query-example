# Audit Log Search Frontend

Amazon Athena 検索結果を表示するための Next.js アプリケーションです。静的サイト (SSG) としてビルドされ、Nginx などで配信することを想定しています。

## 技術スタック

- **Next.js 15+ (App Router)**
- **MUI (Material UI)**: UI コンポーネント
- **TanStack Query (React Query)**: 非同期データフェッチ・状態管理
- **Prettier**: コードフォーマット
- **ビルド形式**: Static Export (`output: 'export'`)

## 主な機能

- **Athena 検索フォーム**: 年・月・日・ユーザーIDを指定して検索。
- **サーバーサイドページネーション**: `DataGrid` を使用し、バックエンドからの `nextToken` を利用して順次データを取得。
- **トータル件数表示**: クエリ結果の全件数を表示。
- **ストリーミング CSV ダウンロード**:
    - `results-stream` から JSON データをストリーム取得し、ブラウザ上で CSV に変換。
    - **FileSystem Access API** を使用し、メモリ消費を抑えながらローカルファイルへ直接書き込み。

## 実行方法

### 依存関係のインストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` でアクセスできます。

## ビルドと配信

### ローカルでのビルド

```bash
# ビルド (out ディレクトリに静的ファイルが生成されます)
npm run build
```

### Docker での実行
プロジェクトルートの `compose.yaml` を使用して、バックエンドとともに起動します。
```bash
docker compose up --build
```

**注意**: 静的サイトとしてビルドされるため、バックエンドの API URL (`NEXT_PUBLIC_API_BASE_URL`) はビルド時に確定させる必要があります。Docker Compose では `args` を使用してビルド引数として渡します。

## コードフォーマット

```bash
# 自動整形
npm run format

# チェックのみ
npm run format:check
```
