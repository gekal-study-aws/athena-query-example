# Audit Log Search Frontend

Amazon Athena 検索結果を表示するための Next.js アプリケーションです。

## 技術スタック

- **Next.js 15 (App Router)**
- **MUI (Material UI)**: UI コンポーネント
- **TanStack Query (React Query)**: 非同期データフェッチ・状態管理
- **Prettier**: コードフォーマット

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

`http://localhost:3000` でアクセスできます。バックエンド (localhost:8080) へのリクエストは `next.config.ts` の `rewrites` 設定によりプロキシされます。

### ビルドと静的解析

```bash
# ビルド (型チェック込)
npm run build

# リンター
npm run lint

# フォーマット
npm run format
```
