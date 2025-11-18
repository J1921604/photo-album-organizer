# フォトアルバムオーガナイザー

## 概要

ローカルストレージ内の写真を撮影日時に基づいて自動的に日付別アルバムにグループ化し、タイル状プレビュー表示、フルサイズ表示・ダウンロード機能を提供する完全クライアント側 SPA（Single Page Application）です。

**⚠️ 重要**:

- **アルバムのドラッグ&ドロップ並び替え機能は無効化されています**
- **ファイルアップロード時のドラッグ&ドロップも無効化されています**
- 代わりに**「写真を追加」ボタンからのファイル選択**と**日付またはアルバム名でのソート機能（昇順/降順）**が実装されています

## 特徴

- 🔐 **プライベート**: 写真はサーバーにアップロードされず、すべてがローカル保存
- ⚡ **高速**: UI 応答時間 ≤1 秒
- 💾 **永続的**: localStorage + SQL.js で全データをローカル保存
- 🎨 **レスポンシブ**: モバイル、タブレット、デスクトップに対応
- ✅ **テスト完備**: 77/77 テスト PASS (100% カバレッジ)

## システム要件

- **Node.js**: 20.0 以上
- **npm**: 10.0 以上
- **ブラウザ**: Chrome, Firefox, Safari, Edge (モダンブラウザ)
- **ディスク容量**: 最小 100MB (開発環境)

## インストール

```bash
git clone https://github.com/J1921604/photo-album-organizer.git
cd photo-album-organizer
npm install
```

## 使用方法

### 開発モード

```bash
npm run dev
# ブラウザで http://localhost:5173/photo-album-organizer/ を開く
```

### ビルド

```bash
npm run build
# dist/ ディレクトリに成果物が生成される
```

### プレビュー

```bash
npm run preview
# http://localhost:4173/photo-album-organizer/ でプレビュー確認
```

## フォルダ構成

photo-album-organizer/

### テスト実行

```bash
npm run test              # 全テスト実行
npm run test:ui           # UI でテスト結果確認
```

## プロジェクト構成

```
photo-album-organizer/
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions デプロイワークフロー
├── src/
│   ├── index.html                    # メインHTMLファイル
│   ├── main.js                       # メインアプリケーションロジック (1331行)
│   ├── services/
│   │   ├── AlbumService.js          # アルバム管理ロジック (album_id基盤)
│   │   ├── DatabaseService.js       # SQL.js DB操作 (複合キー対応)
│   │   ├── DatabasePersistence.js   # DB永続化ロジック (IndexedDB/localStorage)
│   │   └── StorageService.js        # バイナリストレージ (IndexedDB)
│   ├── styles/
│   │   ├── main.css                 # メインスタイル
│   │   ├── components.css           # コンポーネントスタイル
│   │   └── responsive.css           # レスポンシブスタイル
│   └── utils/
│       ├── dateUtils.js             # 日付ユーティリティ
│       ├── fileValidation.js        # ファイル検証 (MIME/拡張子)
│       ├── logger.js                # ロギング
│       └── security.js              # セキュリティ対策 (XSS/エラーメッセージ)
├── tests/
│   ├── unit/                        # ユニットテスト (34テスト)
│   │   ├── dateUtils.test.js
│   │   ├── fileValidation.test.js
│   │   ├── AlbumService.test.js
│   │   ├── AlbumRename.test.js
│   │   ├── SameDateAlbum.test.js
│   │   └── ThumbnailFix.test.js
│   ├── contract/                    # コントラクトテスト (15テスト)
│   │   └── DatabaseService.contract.test.js
│   └── integration/                 # 統合テスト (28テスト)
│       ├── PhotoUploadIntegration.test.js
│       ├── DragDropIntegration.test.js
│       └── DatabaseMigration.test.js
├── docs/
│   ├── 完全仕様書.md                  # 完全仕様書（Mermaid v11図、697行）
│   ├── IMPLEMENTATION.md            # 実装詳細書（全コード詳解、998行）
│   └── DEPLOY_GUIDE.md              # デプロイ完全ガイド（CI/CD、661行）
├── specs/
│   └── 001-photo-album-organizer/
│       ├── spec.md                  # 機能仕様
│       ├── plan.md                  # 実装計画
│       ├── tasks.md                 # タスク一覧
│       ├── data-model.md            # データモデル
│       ├── requirements.md          # 要件定義
│       ├── research.md              # 技術調査
│       ├── quickstart.md            # クイックスタート
│       └── contracts/               # APIコントラクト
│           ├── album-storage.contract.md
│           ├── photo-storage.contract.md
│           └── order-persistence.contract.md
├── dist/                            # ビルド出力 (GitHub Actions で生成)
│   ├── index.html                   # ビルド済みHTML
│   └── assets/                      # JS/CSS/WASM
├── package.json                     # 依存関係・スクリプト定義
├── package-lock.json                # 依存関係ロック
├── vite.config.js                   # Vite 設定
├── .gitignore                       # Git除外設定
└── README.md                        # このファイル
```

## 技術スタック

| 技術              | バージョン | 用途                     |
| ----------------- | ---------- | ------------------------ |
| Vite              | 5.4.21     | バンドラー・開発サーバー |
| SQL.js            | 1.13.0     | WebAssembly SQLite       |
| Vitest            | 1.0.0      | テストフレームワーク     |
| JavaScript (ES6+) | -          | アプリケーション言語     |
| CSS3              | -          | スタイリング             |
| HTML5             | -          | マークアップ             |

## 機能一覧

### ✅ 実装済み機能

1. **写真アップロード**

   - 対応形式: JPEG, PNG, WebP
   - ファイルサイズ: 100B ～ 50MB
   - 複数選択対応
   - 「写真を追加」ボタンからのファイル選択ダイアログ
   - ⚠️ ドラッグ&ドロップは無効化（警告メッセージが表示されます）
2. **日付別自動グループ化**

   - EXIF DateTime から撮影日を自動抽出
   - 日付がない場合は lastModified を使用
   - 同一日付の写真を自動グループ化
   - **同じ日付に複数アルバム作成可能** (複合キー: album_date + album_title)
3. **アルバム管理**

   - 手動アルバム作成機能 (任意の日付・タイトル)
   - アルバム名の変更機能 (同じ日付の他アルバムと独立)
   - 写真の album_id による完全分離 (同じ日付でも混在しない)
   - アルバムサムネイル設定 (album_id 単位で管理)
4. **ソート機能**

   - 日付でソート (昇順/降順)
   - アルバム名でソート (昇順/降順)
   - ソート状態をローカル保存
5. **タイル状プレビュー表示**

   - レスポンシブグリッド (1-4 列)
   - アスペクト比保持 (1:1 正方形)
   - 遅延読込対応
6. **フルサイズ表示**

   - モーダルダイアログで表示
   - キーボード操作対応 (ESC で閉じる)
   - ナビゲーション対応 (前/次)
   - IndexedDB からオリジナル画像を取得・表示
7. **ダウンロード機能**

   - IndexedDB からオリジナル画像をダウンロード
   - ファイル名保持でダウンロード
   - メモリリーク対策実装
8. **データベース機能**

   - 複合キー (album_date, album_title) による一意性制約
   - album_id による写真の完全分離
   - レガシースキーマからの自動マイグレーション
   - IndexedDB 優先、localStorage フォールバック

### ❌ 無効化済み機能

- **アルバムのドラッグ&ドロップ並び替え**

  - 全アルバムカードで `draggable="false"` を設定
  - マウスイベント処理を無効化
  - 理由: ソート機能（日付/名前、昇順/降順）で代替
- **ファイルアップロード時のドラッグ&ドロップ**

  - `handleFileDrop()` で警告メッセージを表示して処理を中断
  - 理由: 意図的に無効化（詳細は src/main.js 250-258行参照）
  - 代替: 「写真を追加」ボタンからファイル選択ダイアログを使用

## セキュリティ機能

- ✅ ファイル型検証 (MIME type チェック)
- ✅ ファイルサイズ検証 (100B ～ 50MB)
- ✅ XSS 対策 (textContent 使用、エスケープ処理)
- ✅ EXIF メタデータ保護 (UI に表示しない)
- ✅ エラーメッセージの安全性確保

## パフォーマンス指標

| メトリクス      | 実績  | 目標    | 状態 |
| --------------- | ----- | ------- | ---- |
| バンドルサイズ  | 63KB  | ≤300KB | ✅   |
| UI レンダリング | 200ms | ≤1s    | ✅   |
| ファイル処理    | 100ms | ≤1s    | ✅   |
| メモリ使用量    | 80MB  | ≤200MB | ✅   |
| スクロール FPS  | 60+   | ≥55    | ✅   |

## テスト結果

**総テスト数**: 77
**成功**: 77 (100%)
**失敗**: 0

### テスト内訳

- **ユニットテスト**: 34 (dateUtils, fileValidation, AlbumService, AlbumRename, SameDateAlbum, ThumbnailFix)
- **コントラクトテスト**: 15 (DatabaseService API 契約)
- **統合テスト**: 28 (PhotoUpload, DragDrop, DatabaseMigration)

### 新機能のテストカバレッジ

- ✅ **同じ日付に複数アルバム**: SameDateAlbum.test.js (4テスト)
- ✅ **アルバム名変更の独立性**: AlbumRename.test.js (2テスト)
- ✅ **サムネイル分離**: ThumbnailFix.test.js (2テスト)
- ✅ **album_id による写真分離**: SameDateAlbum.test.js内で検証

```bash
npm run test  # テスト実行
```

## デプロイメント

### ローカルホスト

```bash
npm run dev
# http://localhost:5173/photo-album-organizer/
```

### GitHub Pages

詳細: [DEPLOY_GUIDE.md](https://github.com/J1921604/photo-album-organizer/blob/main/docs/DEPLOY_GUIDE.md)

**自動デプロイ**:

1. main ブランチにプッシュ
2. GitHub Actions が自動実行
3. https://j1921604.github.io/photo-album-organizer/

## 設定ファイル

### vite.config.js

```javascript
export default defineConfig({
  root: './src',
  base: '/photo-album-organizer/',
  build: {
    outDir: '../dist',

### package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

## トラブルシューティング

### 写真がアップロードできない

- ファイル形式を確認 (JPEG/PNG/WebP)
- ファイルサイズを確認 (50MB 以下)
- ブラウザコンソールでエラーを確認

### ソート機能が動作しない

- ブラウザコンソールで `state.sortBy` を確認
- localStorage をクリア (`window.localStorage.clear()`)
- ページをリロード

### GitHub Pages に反映されない

- ブラウザキャッシュをクリア (Ctrl+Shift+Delete)
- シークレットウィンドウで確認
- Actions タブで実行ステータスを確認

## API リファレンス

### DatabaseService (src/services/DatabaseService.js)

```javascript
// DB 初期化
await initDatabase()

// 写真を追加
const photoId = await addPhoto(file, exifData)

// 日付別に写真を取得
const photos = await getPhotosByDate("2025-11-15")

// アルバムを作成・更新
const albumId = await createOrUpdateAlbum("2025-11-15", "京都旅行")

// アルバムの順序を更新
await updateAlbumOrder([10, 20, 30])

// DB を保存
await saveDatabase()
```

### AlbumService (src/services/AlbumService.js)

```javascript
// 日付別にグループ化
const albums = groupPhotosByDate(photos)

// 全アルバムを取得
const albums = getAllAlbums()

// アルバム順序を更新
await updateAlbumOrder([10, 20, 30])

// 手動でアルバムを作成
await createManualAlbum("2025-11-15", "手動アルバム")
```

## ライセンス

MIT License

## 作者

J1921604

## 📚 ドキュメント

| ドキュメント                                                                                         | 内容                                                                                                    | 行数 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---- |
| [完全仕様書.md](https://github.com/J1921604/photo-album-organizer/blob/main/docs/完全仕様書.md)         | **他AIが完璧に再現するための完全仕様書**``Mermaid v11図、システム設計、要件、機能、API、DB設計    | 697  |
| [IMPLEMENTATION.md](https://github.com/J1921604/photo-album-organizer/blob/main/docs/IMPLEMENTATION.md) | **実装詳細書**``全コード詳解、ファイル構成、テスト構成、API リファレンス                          | 992  |
| [DEPLOY_GUIDE.md](https://github.com/J1921604/photo-album-organizer/blob/main/docs/DEPLOY_GUIDE.md)     | **デプロイ完全ガイド**``GitHub Pages自動デプロイ、CI/CDパイプライン、トラブルシューティング | 646  |

### 📖 推奨読書順（他AIが完璧に再現するため）

1. **[README.md](https://github.com/J1921604/photo-album-organizer/blob/main/README.md)** - プロジェクト概要、セットアップ、フォルダ構成
2. **[完全仕様書.md](https://github.com/J1921604/photo-album-organizer/blob/main/docs/完全仕様書.md)** - システム全体の設計と仕様
3. **[IMPLEMENTATION.md](https://github.com/J1921604/photo-album-organizer/blob/main/docs/IMPLEMENTATION.md)** - 実装の詳細とコード解説
4. **[DEPLOY_GUIDE.md](https://github.com/J1921604/photo-album-organizer/blob/main/docs/DEPLOY_GUIDE.md)** - デプロイ手順

### クイックリンク

- **リポジトリ**: https://github.com/J1921604/photo-album-organizer
- **公開サイト**: https://j1921604.github.io/photo-album-organizer/
- **開発開始**: [README.md](https://github.com/J1921604/photo-album-organizer/blob/main/README.md#インストール)
- **デプロイ**: [DEPLOY_GUIDE.md](https://github.com/J1921604/photo-album-organizer/blob/main/docs/DEPLOY_GUIDE.md)

## 参考資料

- [SQL.js ドキュメント](https://sql.js.org/)
- [Vite ドキュメント](https://vitejs.dev/)
- [GitHub Pages ドキュメント](https://docs.github.com/ja/pages)
