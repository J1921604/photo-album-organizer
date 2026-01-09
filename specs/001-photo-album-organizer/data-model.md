# データモデル定義：フォトアルバムオーガナイザー

**フィーチャー**: フォトアルバムオーガナイザー
**ブランチ**: `001-photo-album-organizer`
**日付**: 2025-11-18
**目的**: Phase 1 の設計段階で、エンティティ・スキーマ・リレーションシップを定義し、実装基準を確立

---

## エンティティ定義

### 1. Photo（写真）

**目的**: アップロードされた写真のメタデータ・コンテンツを保持

**属性**:

| 属性名            | 型                 | 必須 | 長さ/制約           | 用途                       |
| ----------------- | ------------------ | ---- | ------------------- | -------------------------- |
| `id`            | UUID               | ✅   | RFC 4122            | 一意識別子                 |
| `file_name`     | string             | ✅   | max 255             | ファイル表示名             |
| `file_size`     | number             | ✅   | 0 - 53MB            | ファイルサイズ（bytes）    |
| `photo_date`    | ISO 8601 date      | ✅   | YYYY-MM-DD          | 撮影日付（グループ化キー） |
| `photo_time`    | ISO 8601 time      | ⭕   | HH:MM:SS            | 撮影時刻（ソート用）       |
| `mime_type`     | string             | ✅   | max 50              | image/jpeg など            |
| `data_uri`      | string (base64)    | ✅   | unlimited           | 画像バイナリ（base64）     |
| `checksum`      | string (MD5)       | ✅   | 32 chars            | ファイル重複検知用         |
| `exif_data`     | JSON               | ⭕   | 1KB                 | EXIF メタデータ（JSON）    |
| `created_at`    | ISO 8601 timestamp | ✅   | YYYY-MM-DD HH:MM:SS | DB 登録日時                |
| `album_id`      | UUID               | ⭕   | Foreign key         | 属するアルバム             |
| `display_order` | number             | ⭕   | >= 0                | アルバム内表示順           |

**主キー**: `id` (UUID)

**一意性制約**: `(file_name, photo_date)` (同一日付の同名ファイルは不可)

**外部キー**: `album_id` → Album.id (ON DELETE CASCADE)

**インデックス**:

```sql
CREATE INDEX idx_photo_date ON photos(photo_date);
CREATE INDEX idx_album_id ON photos(album_id);
CREATE INDEX idx_created_at ON photos(created_at);
CREATE INDEX idx_checksum ON photos(checksum);  -- 重複検知用
```

**バリデーション規則**:

- `file_name`: 空でない、< 255 文字、`\0` 含まない
- `file_size`: 100 bytes - 50MB
- `photo_date`: ISO 8601 date 形式、妥当な日付（1900-2099 年）
- `photo_time`: ISO 8601 time 形式（タイムゾーン UTC）
- `mime_type`: `image/jpeg`, `image/png`, `image/webp` のみ
- `checksum`: MD5（32 文字の 16 進数）
- `exif_data`: 有効な JSON、max 1KB

**例**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "file_name": "family_vacation_2025.jpg",
  "file_size": 2457600,
  "photo_date": "2025-09-15",
  "photo_time": "14:30:45",
  "mime_type": "image/jpeg",
  "data_uri": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...",
  "checksum": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "exif_data": {
    "Make": "Apple",
    "Model": "iPhone 14",
    "DateTime": "2025:09:15 14:30:45",
    "GPSLatitude": "35.6761",
    "GPSLongitude": "139.6503"
  },
  "created_at": "2025-11-15 09:30:00",
  "album_id": "550e8400-e29b-41d4-a716-446655440002",
  "display_order": 3
}
```

---

### 2. Album（アルバム）

**目的**: 撮影日付ごとにグループ化された写真コレクション

**属性**:

| 属性名            | 型                 | 必須 | 長さ/制約           | 用途                           |
| ----------------- | ------------------ | ---- | ------------------- | ------------------------------ |
| `id`            | UUID               | ✅   | RFC 4122            | 一意識別子                     |
| `album_date`    | ISO 8601 date      | ✅   | YYYY-MM-DD          | アルバム日付（UNIQUE）         |
| `album_name`    | string             | ⭕   | max 255             | ユーザー設定名（将来機能）     |
| `display_order` | number             | ✅   | >= 0                | メインページ表示順序           |
| `photo_count`   | number             | ✅   | >= 0                | アルバム内写真数（キャッシュ） |
| `thumbnail_uri` | string (base64)    | ⭕   | unlimited           | アルバムサムネイル画像         |
| `created_at`    | ISO 8601 timestamp | ✅   | YYYY-MM-DD HH:MM:SS | DB 登録日時                    |
| `updated_at`    | ISO 8601 timestamp | ✅   | YYYY-MM-DD HH:MM:SS | 最終更新日時                   |

**主キー**: `id` (UUID)

**一意性制約**: `album_date` (UNIQUE) - 同一日付のアルバムは 1 つのみ

**インデックス**:

```sql
CREATE INDEX idx_album_date ON albums(album_date);
CREATE INDEX idx_display_order ON albums(display_order);
CREATE INDEX idx_created_at ON albums(created_at);
```

**バリデーション規則**:

- `album_date`: ISO 8601 date 形式、妥当な日付（1900-2099 年）
- `display_order`: 0 以上の整数
- `photo_count`: 0 以上の整数（写真削除時に自動更新）
- `album_name`: オプション、< 255 文字
- `thumbnail_uri`: オプション、base64 エンコード画像

**例**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "album_date": "2025-09-15",
  "album_name": "京都旅行",
  "display_order": 2,
  "photo_count": 42,
  "thumbnail_uri": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...",
  "created_at": "2025-11-15 09:30:00",
  "updated_at": "2025-11-15 10:15:00"
}
```

---

### 3. AlbumOrder（アルバム表示順序）

**目的**: ドラッグ&ドロップによる並び替え順序を永続化

**属性**:

| 属性名            | 型                 | 必須 | 長さ/制約           | 用途         |
| ----------------- | ------------------ | ---- | ------------------- | ------------ |
| `id`            | UUID               | ✅   | RFC 4122            | 一意識別子   |
| `album_id`      | UUID               | ✅   | Foreign key         | 関連アルバム |
| `display_order` | number             | ✅   | >= 0                | 表示順序     |
| `updated_at`    | ISO 8601 timestamp | ✅   | YYYY-MM-DD HH:MM:SS | 最終更新日時 |

**主キー**: `id` (UUID)

**外部キー**: `album_id` → Album.id (ON DELETE CASCADE)

**一意性制約**: `album_id` (UNIQUE)

**インデックス**:

```sql
CREATE INDEX idx_album_order_order ON album_order(display_order);
CREATE INDEX idx_album_order_updated ON album_order(updated_at);
```

**バリデーション規則**:

- `display_order`: 0 以上の整数（重複不可、連番 0, 1, 2, ... n-1）

**例**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "album_id": "550e8400-e29b-41d4-a716-446655440002",
  "display_order": 2,
  "updated_at": "2025-11-15 10:30:00"
}
```

**代替案**: Album の `display_order` に統合可能（AlbumOrder テーブル不要）

---

## リレーションシップ

```
┌─────────────────┐
│    Album        │
├─────────────────┤
│ id (PK)         │
│ album_date (UK) │
│ display_order   │
└────────┬────────┘
         │ 1
         │ (one-to-many)
         │
         │ *
┌────────▼────────────┐
│      Photo          │
├─────────────────────┤
│ id (PK)             │
│ album_id (FK) ──────┘
│ file_name           │
│ photo_date          │
│ photo_time          │
│ data_uri            │
└─────────────────────┘
```

**リレーションシップ種別**: 1:N (One-to-Many)

- Album: 1
- Photo: * (0 以上)

**外部キー制約**:

```sql
ALTER TABLE photos
ADD CONSTRAINT fk_photos_album_id
FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE;
```

**削除時動作**:

- Album 削除時: 関連する Photo は全削除（ON DELETE CASCADE）
- Photo 削除時: Album の photo_count は -1 更新

---

## スキーマ定義（SQL.js 用）

```sql
-- テーブル作成

CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  album_date TEXT NOT NULL UNIQUE,
  album_name TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  photo_count INTEGER NOT NULL DEFAULT 0,
  thumbnail_uri TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  photo_date TEXT NOT NULL,
  photo_time TEXT,
  mime_type TEXT NOT NULL,
  data_uri TEXT NOT NULL,
  checksum TEXT NOT NULL UNIQUE,
  exif_data TEXT,
  created_at TEXT NOT NULL,
  album_id TEXT,
  display_order INTEGER,
  FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE CASCADE,
  UNIQUE(file_name, photo_date)
);

CREATE TABLE album_order (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- インデックス作成

CREATE INDEX idx_photos_photo_date ON photos(photo_date);
CREATE INDEX idx_photos_album_id ON photos(album_id);
CREATE INDEX idx_photos_created_at ON photos(created_at);
CREATE INDEX idx_photos_checksum ON photos(checksum);
CREATE INDEX idx_photos_display_order ON photos(display_order);

CREATE INDEX idx_albums_album_date ON albums(album_date);
CREATE INDEX idx_albums_display_order ON albums(display_order);
CREATE INDEX idx_albums_created_at ON albums(created_at);

CREATE INDEX idx_album_order_order ON album_order(display_order);
CREATE INDEX idx_album_order_updated ON album_order(updated_at);
```

---

## データフロー

### フロー 1: ファイルアップロード → アルバムグループ化

```
1. ユーザーが複数写真を選択
   ↓
2. fileValidation.validateFile() でファイル型・サイズ検証
   ↓
3. 各ファイルについて:
   a) FileReader で base64 data URI に変換
   b) EXIF/メタデータ抽出（exif-js ライブラリ等）
   c) checksum (MD5) 計算して重複検知
   d) Photo オブジェクト作成
   ↓
4. DatabaseService.addPhoto(photo) で DB に保存
   ↓
5. photo.photo_date に該当する Album が存在？
   - Yes: photo.album_id に Album ID をセット
   - No: 新規 Album を createAlbum() で作成
   ↓
6. AlbumService.groupPhotosByDate() で全 Photo を photo_date でグループ化
   ↓
7. メインページで Album リスト表示
```

### フロー 2: アルバム並び替え（ドラッグ&ドロップ）

```
1. メインページでアルバムカードをドラッグ
   ↓
2. dragstart イベント: dataTransfer に album ID を設定
   ↓
3. dragover イベント: drop zone を強調
   ↓
4. drop イベント:
   a) 新しい表示順序を計算
   b) Album.display_order を更新
   ↓
5. DatabaseService.updateAlbumOrder() で DB に保存
   ↓
6. メインページ再レンダリング（新しい display_order でソート）
```

### フロー 3: 写真フルサイズ表示・ダウンロード

```
1. アルバムビューでサムネイルをクリック
   ↓
2. FullsizeModal を表示、Photo.data_uri をセット
   ↓
3. ユーザーが「ダウンロード」ボタンクリック
   ↓
4. data_uri から Blob 作成
   ↓
5. URL.createObjectURL() で blob URL 生成
   ↓
6. <a> 要素の href に blob URL をセット
   ↓
7. click イベントでダウンロード実行（OS の download 機能呼び出し）
   ↓
8. URL.revokeObjectURL() で メモリ解放
```

---

## 型定義（TypeScript 相当）

```typescript
interface Photo {
  id: string;          // UUID
  file_name: string;   // max 255
  file_size: number;   // bytes
  photo_date: string;  // YYYY-MM-DD
  photo_time?: string; // HH:MM:SS
  mime_type: string;   // image/jpeg | image/png | image/webp
  data_uri: string;    // base64 encoded
  checksum: string;    // MD5
  exif_data?: any;     // JSON
  created_at: string;  // ISO 8601
  album_id?: string;   // UUID, nullable
  display_order?: number;
}

interface Album {
  id: string;           // UUID
  album_date: string;   // YYYY-MM-DD, unique
  album_name?: string;  // max 255
  display_order: number; // >= 0
  photo_count: number;  // >= 0
  thumbnail_uri?: string; // base64 encoded
  created_at: string;   // ISO 8601
  updated_at: string;   // ISO 8601
}

interface AlbumOrder {
  id: string;          // UUID
  album_id: string;    // UUID, FK, unique
  display_order: number; // >= 0
  updated_at: string;  // ISO 8601
}
```

---

## バリデーション・エラーハンドリング

### Photo バリデーション

| 項目       | 規則                     | エラーコード           |
| ---------- | ------------------------ | ---------------------- |
| file_name  | not empty, < 255 chars   | ERR_INVALID_FILENAME   |
| file_size  | 100B - 50MB              | ERR_INVALID_FILE_SIZE  |
| photo_date | ISO 8601 date, 1900-2099 | ERR_INVALID_PHOTO_DATE |
| mime_type  | JPEG/PNG/WebP only       | ERR_INVALID_MIME_TYPE  |
| checksum   | MD5, not exists in DB    | ERR_DUPLICATE_FILE     |

### Album バリデーション

| 項目          | 規則             | エラーコード              |
| ------------- | ---------------- | ------------------------- |
| album_date    | ISO 8601, unique | ERR_INVALID_ALBUM_DATE    |
| display_order | >= 0, no gap     | ERR_INVALID_DISPLAY_ORDER |
| photo_count   | >= 0             | ERR_INVALID_PHOTO_COUNT   |

### エラー処理フロー

```javascript
try {
  const photo = await DatabaseService.addPhoto(file);
} catch (error) {
  switch (error.code) {
    case 'ERR_INVALID_MIME_TYPE':
      alert('JPEG・PNG・WebP 形式のみサポートしています');
      break;
    case 'ERR_INVALID_FILE_SIZE':
      alert('ファイルサイズは 100B～50MB の範囲で選択してください');
      break;
    case 'ERR_DUPLICATE_FILE':
      alert('このファイルは既に登録されています');
      break;
    default:
      alert('ファイルアップロードに失敗しました');
  }
}
```

---

## パフォーマンス考慮事項

### インデックス戦略

**クエリ最適化**:

- `photo_date` インデックス: GROUP BY での高速化
- `album_id` インデックス: JOIN での高速化
- `display_order` インデックス: ORDER BY での高速化

**期待 Query Time**:

- `SELECT * FROM photos WHERE photo_date = '2025-09-15'`: < 50ms
- `SELECT * FROM albums ORDER BY display_order`: < 10ms
- `SELECT COUNT(*) FROM photos WHERE album_id = ?`: < 20ms

### メモリ効率

**推定メモリ消費**:

- Photo 1 件: ~50KB (data_uri base64 40KB + metadata 10KB)
- Album 1 件: ~1KB
- 1000 Photo の合計: ~50MB

**メモリ最適化**:

- data_uri は必要時のみメモリにロード（全メモリに保持しない）
- Lazy loading で必要な写真のみ base64 decode

---

## マイグレーション戦略（将来）

### Version 1.1 への移行例

```sql
-- 新しいカラム追加
ALTER TABLE albums ADD COLUMN description TEXT DEFAULT '';

-- デフォルト値をセット
UPDATE albums SET description = '' WHERE description IS NULL;

-- 新規カラムに インデックス追加
CREATE INDEX idx_albums_description ON albums(description);
```

---

## テストケース

### ユニットテスト

```javascript
describe('Photo Entity', () => {
  it('有効な Photo オブジェクトを作成', () => {
    const photo = {
      id: 'uuid-1',
      file_name: 'photo.jpg',
      file_size: 1024,
      photo_date: '2025-09-15',
      mime_type: 'image/jpeg',
      data_uri: 'data:image/jpeg;base64,...',
      checksum: 'a1b2c3...',
      created_at: '2025-11-15T09:30:00Z'
    };
    expect(validatePhoto(photo)).toBe(true);
  });

  it('無効な file_size を reject', () => {
    const photo = { ...validPhoto, file_size: 60 * 1024 * 1024 };  // 60MB
    expect(validatePhoto(photo)).toBe(false);
  });

  it('重複 checksum を reject', async () => {
    const existingPhoto = { checksum: 'abc123' };
    await db.addPhoto(existingPhoto);
  
    const duplicatePhoto = { checksum: 'abc123' };
    expect(async () => await db.addPhoto(duplicatePhoto)).rejects();
  });
});

describe('Album Entity', () => {
  it('album_date の一意性を強制', async () => {
    await db.createAlbum({ album_date: '2025-09-15' });
    expect(async () => 
      await db.createAlbum({ album_date: '2025-09-15' })
    ).rejects();
  });
});
```
