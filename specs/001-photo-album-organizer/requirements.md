# 要求仕様: フォトアルバムオーガナイザー

**ブランチ**: `001-photo-album-organizer` | **日付**: 2025-11-18 | **仕様**: spec.md

## 概要

フォトアルバムオーガナイザーは、ユーザーのローカルストレージ内の写真を日付別に自動グループ化し、ドラッグ&ドロップで再編成できるWebアプリケーション。GitHub Pagesでホスティングされ、完全にクライアント側で動作し、外部サーバーへのアップロードは行わない。

## 技術的背景

**プロジェクトタイプ**: シングルページアプリケーション（SPA）
**ホスティング**: GitHub Pages（静的ホスト）
**フロントエンド言語**: JavaScript（標準）+ HTML + CSS
**フレームワーク**: なし（Vanilla JS + Vite）
**バンドラー**: Vite
**ストレージ**: ローカルストレージ + ローカルSQLiteデータベース（Web SQL / IndexedDB代替）
**テスト**: Jest、Vitest、またはシンプルなテストフレームワーク
**対象プラットフォーム**: モダンWebブラウザ（Chrome、Firefox、Safari、Edge）
**パフォーマンスゴール**: UI応答時間1秒以内、メモリ使用量200MB以下
**制約**: <300KBのJavaScriptバンドル、外部依存最小化、再現性確保のためバージョン固定

## 憲法チェック

*ゲート: Phase 0リサーチ前に合格する必要があります。*

**三原則遵守確認**:

- ✅ **原則 I - テスト駆動開発**: すべての受け入れシナリオはテスト対象となり、実装前にテストを作成
- ✅ **原則 II - セキュリティ優先**: SEC-001〜004で明示的に定義。メタデータ暗号化必須、外部アップロード禁止
- ✅ **原則 III - パフォーマンス定量化**: PERF-001〜004ですべてのメトリクスが定量化。受け入れ基準に組み込み

**ゲート結果**: **合格** ✅

## プロジェクト構造

### ドキュメント（このフィーチャー）

```
specs/001-photo-album-organizer/
├── spec.md                  # 仕様書（ユーザーストーリー、要件、成功基準）
├── requirements.md          # このファイル
├── plan.md                  # 実装計画（Phase 0出力予定）
├── research.md              # 技術リサーチ結果（Phase 0出力予定）
├── data-model.md            # データモデル詳細（Phase 1出力予定）
├── quickstart.md            # クイックスタートガイド（Phase 1出力予定）
├── contracts/               # API/ストレージコントラクト（Phase 1出力予定）
│   ├── photo-storage.contract.md
│   ├── album-storage.contract.md
│   └── order-persistence.contract.md
└── tasks.md                 # タスクリスト（Phase 2出力予定）
```

### ソースコード（リポジトリルート）

```
src/
├── index.html               # メインHTMLエントリポイント
├── main.js                  # アプリケーションエントリポイント
├── components/
│   ├── MainPage.js          # メインページコンポーネント
│   ├── AlbumView.js         # アルバムビューコンポーネント
│   ├── TileGrid.js          # タイル状グリッドコンポーネント
│   └── FullsizeModal.js     # フルサイズ表示モーダル
├── services/
│   ├── StorageService.js    # ローカルストレージ操作
│   ├── MetadataService.js   # メタデータ抽出・処理
│   ├── DatabaseService.js   # SQLiteデータベース操作
│   └── AlbumService.js      # アルバムグループ化ロジック
├── utils/
│   ├── dateUtils.js         # 日時ユーティリティ
│   ├── fileValidation.js    # ファイル型検証
│   └── logger.js            # ログ機構
└── styles/
    ├── main.css             # グローバルスタイル
    ├── components.css       # コンポーネント固有スタイル
    └── responsive.css       # レスポンシブデザイン

tests/
├── unit/
│   ├── MetadataService.test.js
│   ├── AlbumService.test.js
│   └── dateUtils.test.js
├── integration/
│   ├── PhotoUpload.test.js
│   ├── AlbumGrouping.test.js
│   └── DragDrop.test.js
└── contract/
    ├── StorageContract.test.js
    └── DatabaseContract.test.js

public/
├── index.html               # GitHub Pages用静的ファイル
└── favicon.ico

build/                         # Viteビルド出力（.gitignoreに追加）
dist/                          # 本番ビルド出力（GitHub Pagesデプロイ対象）
```

**構造決定根拠**:

- GitHub Pagesでの静的ホスティングのため、`public/`と `dist/`のみがホストされる
- テストは `tests/`で組織化され、独立して実行可能
- サービス層で業務ロジックを分離し、テスト可能性を向上

## ユーザーストーリーマッピング

| ユーザーストーリー      | 優先度 | 主要な要件             | 成功基準 | 推定工数 |
| ----------------------- | ------ | ---------------------- | -------- | -------- |
| US1: 日付別アルバム整理 | P1     | FR-001,002,003,004,009 | SC-001   | 3-4日    |
| US2: タイル状プレビュー | P2     | FR-005                 | SC-002   | 2-3日    |
| US3: フルサイズ表示・DL | P3     | FR-006,007             | SC-003   | 1-2日    |

## 非機能要件

| 要件               | 目標値                                  | 測定方法                                |
| ------------------ | --------------------------------------- | --------------------------------------- |
| UI応答時間         | ≤1秒                                   | ブラウザDev Tools、Lighthouseスコア     |
| メモリ使用量       | ≤200MB                                 | Chrome DevTools Memory Profiler         |
| バンドルサイズ     | ≤300KB                                 | Viteビルド出力、webpack-bundle-analyzer |
| 大規模アルバム対応 | 1000+写真                               | 機能テスト、パフォーマンステスト        |
| ブラウザ互換性     | Chrome, Firefox, Safari, Edge (最新2版) | 自動テスト、手動テスト                  |

## リスクと制約

### 技術リスク

1. **SQLiteのWeb実装**: ブラウザネイティブなSQLiteはなく、IndexedDB + SQLite.jsまたはWasm版を使用する可能性

   - **軽減策**: 技術選定フェーズで検証、プロトタイプ作成
2. **大規模ファイル処理**: 1000枚以上の写真読み込み時のメモリ爆発

   - **軽減策**: 仮想スクロール、遅延ロード、メモリプロファイリング
3. **ブラウザのFile API制限**: セキュリティ制約により、すべてのローカルファイルへのアクセスが制限される可能性

   - **軽減策**: ユーザーが明示的にファイルを選択する方式（HTML `<input type="file">` または Drag&Drop）

### 制約

- GitHub Pagesでのホスティングのため、動的サーバーコンポーネントなし
- 外部APIとの通信は最小限（GitHub Pages自体の静的配信のみ）
- ローカルストレージまたはIndexedDBの容量制限（通常5-50MB）に依存

## 受け入れ基準（全体）

全ユーザーストーリーが完了し、以下の条件が満たされている場合、フィーチャーは本番デプロイ可能と見なされます：

- ✅ すべてのテストが合格（単体テスト、統合テスト、コントラクトテスト）
- ✅ 手動テストでセキュリティ要件（SEC-001〜004）が検証
- ✅ パフォーマンステストでPERF-001〜004が達成
- ✅ GitHub Pages上で正常に動作確認
- ✅ ドキュメント（quickstart.md、API仕様）が完成
- ✅ コードレビューで仕様との乖離なし

## 次のステップ

1. `/speckit.plan` コマンドでPhase 0リサーチを実行（SQLite.js vs IndexedDB、Viteプロジェクト初期化検証）
2. Phase 1でデータモデル、API仕様、タスク分解を完成
3. `/speckit.tasks` コマンドで実装タスクを生成
4. 実装ブランチでコード生成と検証
