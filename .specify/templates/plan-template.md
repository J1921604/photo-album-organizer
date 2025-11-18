# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## 技術コンテキスト

<!--
  アクション必須: このセクションの内容を、プロジェクトの技術詳細で置き換えてください。
  下記の構造は、反復プロセスを導くための推奨形式です。
-->

**言語/バージョン**: [例: JavaScript (Vite), Python 3.11, その他 or 要確認]  
**主要依存**: [例: sql.js, terser, その他 or 要確認]  
**ストレージ**: [該当する場合: localStorage, IndexedDB, SQLite, その他 or N/A]  
**テスト**: [例: Vitest, Jest, その他 or 要確認]  
**対象プラットフォーム**: [例: Web (Chrome/Firefox), モバイルブラウザ, Node.js など or 要確認]
**プロジェクトタイプ**: [単体/Web/モバイル]  
**パフォーマンスゴール**: [UI 応答≤1秒, バンドル≤300KB, メモリ≤200MB など]  
**制約**: [デスクトップ/モバイル対応, オフライン対応, プライベートデータ処理など]  
**スケール/スコープ**: [ユーザー数, ファイル処理枚数, 画面数など]

## 憲法チェック（ゲート: Phase 0 前に合格必須）

*本セクションは `.specify/memory/constitution.md` に基づいて評価します。*

フィーチャーが以下の 5 原則を満たすことを確認してください:

- **原則 I. テスト駆動開発**: Red-Green-Refactor サイクル、3 層テスト戦略（単体・統合・コントラクト）実装予定か?
- **原則 II. セキュリティ優先**: 機密データ暗号化、外部送信禁止、ファイル検証 3 層を実装予定か?
- **原則 III. パフォーマンス定量化**: UI 応答≤1秒、バンドル≤300KB、メモリ≤200MB、受け入れ基準に組み込まれているか?
- **原則 IV. ユーザー体験一貫性**: デザイン言語統一、エラーメッセージ明示、アクセシビリティ対応予定か?
- **原則 V. コード品質**: ESLint + Prettier、複雑度チェック、バージョン固定、カバレッジ維持予定か?

**ゲート結果**: ☐ 合格 ☐ 条件付き合格（理由: [記入]) ☐ 不合格

**不合格時**: Phase 0 進行禁止。条件を満たすまで仕様を修正してください。

## プロジェクト構造

### ドキュメント（このフィーチャー）

```text
specs/[###-feature]/
├── plan.md              # このファイル (/speckit.plan コマンド出力)
├── research.md          # Phase 0 出力 (/speckit.plan コマンド)
├── data-model.md        # Phase 1 出力 (/speckit.plan コマンド)
├── quickstart.md        # Phase 1 出力 (/speckit.plan コマンド)
├── contracts/           # Phase 1 出力 (/speckit.plan コマンド)
└── tasks.md             # Phase 2 出力 (/speckit.tasks コマンド - /speckit.plan では作成されない)
```

### ソースコード（リポジトリルート）
<!--
  アクション必須: 下記のプレースホルダーツリーを、このフィーチャーの具体的なレイアウトで置き換えてください。
  未使用のオプションは削除し、実際のパス（例: apps/admin, packages/something）で展開してください。
  配信される計画にはオプションラベルを含めないでください。
-->

```text
# [未使用の場合は削除] オプション 1: 単一プロジェクト（デフォルト）
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [未使用の場合は削除] オプション 2: Web アプリケーション（「frontend」「backend」検出時）
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [未使用の場合は削除] オプション 3: モバイル + API（「iOS/Android」検出時）
api/
└── [backend と同じ構造]

ios/ or android/
└── [プラットフォーム固有: フィーチャーモジュール, UI フロー, プラットフォームテスト]
```

**構造決定**: [選択した構造を説明し、上記で取得した実際のディレクトリを参照してください]

## 複雑度トラッキング

> **憲法チェック違反が発見された場合のみ記入してください**

| 違反項目 | 必要な理由 | より単純な代替案が不十分な理由 |
|-----------|------------|-------------------------------------|
| [例: 4 つ目のプロジェクト] | [現在の必要性] | [3 つのプロジェクトが不十分な理由] |
| [例: Repository パターン] | [具体的な問題] | [直接 DB アクセスが不十分な理由] |
