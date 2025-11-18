# クイックスタートガイド：フォトアルバムオーガナイザー

**対象**: 開発者向けセットアップ・実装開始ガイド
**プロジェクト**: photo-album-organizer
**ブランチ**: `001-photo-album-organizer`
**日付**: 2025-11-18

---

## 前提条件

- **Node.js**: 16.0.0 以上
- **npm**: 8.0.0 以上
- **Git**: 2.0 以上
- **ブラウザ**: Chrome/Firefox/Safari/Edge（最新 2 版）

### インストール確認

```bash
node --version     # v16.x.x 以上
npm --version      # 8.x.x 以上
git --version      # 2.x.x 以上
```

---

## リポジトリのクローン

```bash
# GitHub からクローン
git clone https://github.com/J1921604/photo-album-organizer.git
cd photo-album-organizer

# ブランチ確認（main であることを確認）
git branch --show-current
```

---

## 環境構築

### 1. 依存関係のインストール

```bash
npm install
```

**出力例**:

```
added 102 packages in 2.5s
```

**確認項目**:

- ✅ `node_modules/` ディレクトリが作成される
- ✅ `package-lock.json` が生成される

### 2. バージョン確認

```bash
npm list vite vitest sql.js
```

**期待される出力**:

```
├── vite@5.0.0
├── vitest@1.0.0
├── sql.js@1.8.0
└── terser@5.44.1
```

---

## 開発サーバーの起動

### 方法 1: PowerShell（Windows 推奨）

```bash
.\start.ps1
```

**動作**:

- 依存関係をインストール
- `npm run dev` を実行
- ブラウザが自動的に `http://localhost:5173/photo-album-organizer/` で開く
- サーバーが起動したままコマンド終了待機

### 方法 2: Bash/Terminal（macOS/Linux）

```bash
npm run dev
```

**出力**:

```
VITE v5.0.0  ready in 523 ms

➜  Local:   http://localhost:5173/photo-album-organizer/
➜  press h to show help
```

### 方法 3: 手動起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173/photo-album-organizer/` にアクセス

---

## アプリケーションの動作確認

### 1. ファイルアップロード

1. **「写真を読み込む」ボタンをクリック**

   - またはドラッグ&ドロップエリアにファイルをドラッグ
2. **ローカルから写真を選択**（複数可）

   - サポート形式: JPEG, PNG, WebP
   - 最大ファイルサイズ: 50MB
3. **期待される結果**:

   - 写真が読み込まれる
   - メタデータ（撮影日時）が自動抽出される
   - メインページに日付別アルバムが表示される

### 2. アルバム並び替え

1. **メインページでアルバムカードをドラッグ**
2. **別のアルバムカード上にドロップして並び替え**
3. **期待される結果**:
   - アルバムの順序が変更される
   - ブラウザを再起動後も順序が保持されている

### 3. タイル表示

1. **アルバムカードをクリック**
2. **アルバムビューが表示**
3. **期待される結果**:
   - 写真がタイル状グリッド（3 行 × 4 列推奨）で表示される

### 4. フルサイズ表示

1. **タイル上の写真をクリック**
2. **フルサイズモーダルが表示**
3. **期待される結果**:
   - フルサイズ画像が中央に表示される

### 5. ダウンロード

1. **「ダウンロード」ボタンをクリック**
2. **期待される結果**:
   - ブラウザの download 機能で PC にファイルが保存される

---

## プロジェクト構造の確認

```
photo-album-organizer/
├── src/
│   ├── index.html               # メイン UI テンプレート
│   ├── main.js                  # アプリケーションエントリポイント
│   ├── components/              # UI コンポーネント（予定）
│   ├── services/
│   │   ├── DatabaseService.js   # SQL.js DB 操作
│   │   └── AlbumService.js      # ビジネスロジック
│   ├── utils/
│   │   ├── dateUtils.js         # 日時処理
│   │   ├── fileValidation.js    # ファイル検証
│   │   └── logger.js            # ログシステム
│   └── styles/
│       ├── main.css             # グローバルスタイル
│       ├── components.css       # コンポーネント
│       └── responsive.css       # レスポンシブ
├── tests/
│   ├── unit/                    # ユニットテスト
│   ├── integration/             # 統合テスト
│   └── contract/                # コントラクトテスト
├── specs/
│   └── 001-photo-album-organizer/
│       ├── spec.md              # ユーザーストーリー
│       ├── requirements.md      # 技術要件
│       ├── plan.md              # 実装計画
│       ├── research.md          # 技術リサーチ
│       ├── data-model.md        # データモデル
│       ├── quickstart.md        # このファイル
│       └── contracts/           # ストレージコントラクト
├── package.json                 # 依存関係定義
├── vite.config.js               # Vite 設定
├── README.md                    # ユーザー向けドキュメント
├── start.ps1                    # Windows 起動スクリプト
└── start.sh                     # Unix 起動スクリプト
```

---

## テストの実行

### ユニットテスト

```bash
# すべてのテストを実行
npm run test

# 特定のテストファイルのみ実行
npm run test -- tests/unit/dateUtils.test.js

# Watch mode（ファイル変更時に自動再実行）
npm run test -- --watch

# カバレッジレポート
npm run test -- --coverage
```

### テスト UI（ビジュアル確認）

```bash
npm run test:ui
```

**期待される動作**:

- `http://localhost:51204/__vitest__/` でテスト結果の UI が開く
- 各テストの合否を視覚的に確認可能

---

## ビルド・デプロイメント

### 本番ビルド

```bash
npm run build
```

**出力**:

```
vite v5.0.0 building for production...
✓ 1234 modules transformed.
dist/index.html                 3.2 kb │ gzip:     1.2 kb
dist/assets/main-abc123.js     10.26 kb │ gzip:     4.2 kb
dist/assets/main-def456.css     5.05 kb │ gzip:     1.8 kb
dist/assets/sql-ghi789.js      44.00 kb │ gzip:    12.5 kb
✓ built in 2.34s
```

**確認項目**:

- ✅ `dist/` ディレクトリが生成される
- ✅ バンドルサイズが 300KB 以下（現在: 63KB）

### プレビュー

```bash
npm run preview
```

**動作**:

- 本番ビルドをローカルでプレビュー
- `http://localhost:4173/photo-album-organizer/` でテスト可能

### GitHub Pages へのデプロイ

```bash
# main ブランチにプッシュすると自動デプロイ
git add .
git commit -m "build: production build for GitHub Pages deployment"
git push origin feature/impl-001-photo-album-organizer

# その後、GitHub のリポジトリ設定で:
# Settings → Pages → Source: Deploy from a branch
# Branch: feature/impl-001-photo-album-organizer, folder: /dist
```

---

## デバッグとトラブルシューティング

### ブラウザ DevTools の活用

#### Console でエラーを確認

```javascript
// main.js に logger を統合
logger.info('フィーチャー初期化開始');
logger.error('エラー内容', errorObject);
```

#### メモリプロファイリング

1. **Chrome DevTools → Memory タブ**
2. **Heap Snapshot を取得**
3. **アプリ操作後、再度 Snapshot を取得**
4. **比較してメモリリークを検出**

#### パフォーマンスプロファイリング

1. **Chrome DevTools → Performance タブ**
2. **Recording 開始**
3. **アプリを操作（写真追加、ドラッグ&ドロップ等）**
4. **Recording 停止**
5. **Main Thread の作業時間を確認**（目標: < 1 秒）

### よくある問題と解決策

| 問題                            | 原因                         | 解決策                                          |
| ------------------------------- | ---------------------------- | ----------------------------------------------- |
| `Cannot find module 'sql.js'` | 依存関係未インストール       | `npm install` を実行                          |
| WASM ロード失敗                 | ブラウザの WASM サポート不足 | 最新ブラウザを使用                              |
| localhost:5173 が開かない       | ポート衝突                   | `npm run dev -- --port 5174` で別ポート指定   |
| データ保存されない              | localStorage 満杯            | DevTools で localStorage をクリア               |
| スタイルが反映されない          | CSS キャッシュ               | ブラウザキャッシュをクリア（Ctrl+Shift+Delete） |

### ログレベルの調整

```javascript
// src/utils/logger.js
const logger = createLogger({
  level: 'DEBUG'  // INFO, WARN, ERROR, DEBUG
});
```

---

## ファイル編集時のホットリロード

Vite の HMR（Hot Module Replacement）により、ファイル保存時に自動で変更が反映されます:

- **JavaScript** 変更 → 即座に再評価
- **CSS** 変更 → スタイルのみ更新（ページリロード不要）
- **HTML** 変更 → ページリロード

例：

```javascript
// src/main.js を編集して保存 → ブラウザが自動更新
```

---

## Git ワークフロー

### ブランチ管理

```bash
# 現在のブランチを確認
git branch --show-current
# 出力: feature/impl-001-photo-album-organizer

# 実装完了後、main へのマージを準備
git status
git add .
git commit -m "feat: implement photo album organizer features"
git push origin feature/impl-001-photo-album-organizer
```

### コミットメッセージの規約

仕様に従い、以下のフォーマットでコミット:

```
<type>: <subject>

<body>

<footer>
```

**タイプ**:

- `feat`: 新機能
- `fix`: バグ修正
- `test`: テスト追加・修正
- `docs`: ドキュメント
- `build`: ビルド・バンドル関連
- `perf`: パフォーマンス最適化
- `refactor`: コード構造変更

**例**:

```
feat: add photo grouping by date functionality

- Extract EXIF metadata from uploaded files
- Group photos by photo_date (YYYY-MM-DD)
- Store metadata in sql.js database
- Render grouped albums on main page

Fixes #123
```

---

## 次のステップ

### フェーズ 2: テスト実装（TDD）

1. **ユニットテスト作成**

   ```bash
   npm run test -- --watch
   ```
2. **テストファーストで実装**

   - test ファイルを先に作成
   - テスト失敗を確認
   - 最小限の実装でテスト通過
   - リファクタリング

### フェーズ 3: セキュリティレビュー

- SEC-001～004 要件の検証
- コード review で XSS/CSRF 対策確認
- セキュリティテスト実施

### フェーズ 4: パフォーマンステスト

```bash
# Lighthouse でスコア確認
npm run build
npm run preview
# → ブラウザで http://localhost:4173 を Lighthouse で検査
```

---

## 参考資料

- **Vite ドキュメント**: https://vitejs.dev/
- **sql.js**: https://github.com/sql-js/sql.js
- **Vitest**: https://vitest.dev/
- **MDN Web Docs - File API**: https://developer.mozilla.org/ja/docs/Web/API/File
- **MDN Web Docs - Drag and Drop API**: https://developer.mozilla.org/ja/docs/Web/API/HTML_Drag_and_Drop_API

---

## サポート

### 質問がある場合

- **Issue**: GitHub Issues にバグ報告・質問を投稿
- **Discussion**: GitHub Discussions で機能提案

### ローカル開発環境のリセット

```bash
# node_modules と package-lock.json を削除
rm -rf node_modules package-lock.json

# 再インストール
npm install

# キャッシュクリア
npm cache clean --force
```
