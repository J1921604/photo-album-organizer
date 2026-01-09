# ストレージコントラクト：Album Storage

**フィーチャー**: フォトアルバムオーガナイザー  
**コンポーネント**: DatabaseService.js  
**日付**: 2025-11-18  
**目的**: Album エンティティの永続化インタフェース定義、実装とテストの双方が満たすべき要件を明文化

---

## インタフェース定義

### メソッド仕様

#### 1. createOrUpdateAlbum(date: string, albumName?: string): Promise<Album>

**目的**: 指定日付のアルバムを作成、または既存の場合は更新

**入力**:
- `date: string` - ISO 8601 date 形式 (YYYY-MM-DD)
- `albumName?: string` (オプション) - ユーザー設定のアルバム名

**出力**: Promise<Album>
```typescript
{
  id: string;          // UUID
  album_date: string;  // YYYY-MM-DD (入力と同一)
  album_name?: string; // ユーザー設定名
  display_order: number; // 既存: 変更なし、新規: 現在の最後 + 1
  photo_count: number; // 関連 Photo 数
  thumbnail_uri?: string; // アルバムサムネイル
  created_at: string;  // ISO 8601 timestamp
  updated_at: string;  // ISO 8601 timestamp
}
```

**エラーハンドリング**:

| エラー | コード | 説明 |
|--------|--------|------|
| 無効な日付形式 | ERR_INVALID_DATE_FORMAT | YYYY-MM-DD 形式でない |
| DB エラー | ERR_DB_ERROR | SQL.js エラー |

**実装例**:
```javascript
async createOrUpdateAlbum(date, albumName = null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw { code: 'ERR_INVALID_DATE_FORMAT' };
  }

  const existing = await this.queryDatabase(
    `SELECT * FROM albums WHERE album_date = ?`,
    [date]
  );

  if (existing.length > 0) {
    // 既存の場合: album_name をアップデート（指定された場合）
    if (albumName) {
      await this.execute(
        `UPDATE albums SET album_name = ?, updated_at = ? WHERE album_date = ?`,
        [albumName, new Date().toISOString(), date]
      );
    }
    return existing[0];
  }

  // 新規作成
  const maxOrder = await this.queryDatabase(`SELECT MAX(display_order) as max_order FROM albums`);
  const displayOrder = (maxOrder[0]?.max_order || 0) + 1;

  const album = {
    id: generateUUID(),
    album_date: date,
    album_name: albumName,
    display_order: displayOrder,
    photo_count: 0,
    thumbnail_uri: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await this.execute(
    `INSERT INTO albums VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    Object.values(album)
  );

  return album;
}
```

**テストケース**:
```javascript
describe('DatabaseService.createOrUpdateAlbum', () => {
  it('新規アルバムを作成', async () => {
    const album = await db.createOrUpdateAlbum('2025-09-15');
    expect(album.id).toBeDefined();
    expect(album.album_date).toBe('2025-09-15');
    expect(album.display_order).toBe(0);
  });

  it('複数アルバムの display_order は連番', async () => {
    const album1 = await db.createOrUpdateAlbum('2025-09-15');
    const album2 = await db.createOrUpdateAlbum('2025-09-14');
    const album3 = await db.createOrUpdateAlbum('2025-09-13');
    
    expect(album1.display_order).toBe(0);
    expect(album2.display_order).toBe(1);
    expect(album3.display_order).toBe(2);
  });

  it('既存アルバムで album_name をアップデート', async () => {
    const album1 = await db.createOrUpdateAlbum('2025-09-15', '京都旅行');
    const album2 = await db.createOrUpdateAlbum('2025-09-15', '京都観光');
    
    expect(album2.album_name).toBe('京都観光');
    expect(album1.id).toBe(album2.id);  // 同一 ID
  });

  it('無効な日付形式を reject', async () => {
    expect(async () => 
      await db.createOrUpdateAlbum('2025/09/15')
    ).rejects.toThrow('ERR_INVALID_DATE_FORMAT');
  });
});
```

---

#### 2. getAllAlbumDates(sortOrder?: 'display_order' | 'date'): Promise<Album[]>

**目的**: すべてのアルバムをリスト表示用に取得

**入力**:
- `sortOrder?: string` (オプション) - ソート順序
  - `'display_order'` (デフォルト): メインページ表示順
  - `'date'`: 撮影日付でソート（降順: 最新が先）

**出力**: Promise<Album[]>
- Album 配列、指定のソート順序で返す
- 該当なしで空配列 `[]`

**実装例**:
```javascript
async getAllAlbumDates(sortOrder = 'display_order') {
  let query = `SELECT * FROM albums`;

  if (sortOrder === 'date') {
    query += ` ORDER BY album_date DESC`;
  } else {
    query += ` ORDER BY display_order ASC`;
  }

  const result = await this.queryDatabase(query);
  return result || [];
}
```

**テストケース**:
```javascript
describe('DatabaseService.getAllAlbumDates', () => {
  beforeEach(async () => {
    await db.createOrUpdateAlbum('2025-09-15');
    await db.createOrUpdateAlbum('2025-09-10');
    await db.createOrUpdateAlbum('2025-09-20');
  });

  it('display_order でソート', async () => {
    const albums = await db.getAllAlbumDates('display_order');
    expect(albums[0].display_order).toBe(0);
    expect(albums[1].display_order).toBe(1);
  });

  it('album_date 降順でソート', async () => {
    const albums = await db.getAllAlbumDates('date');
    expect(albums[0].album_date).toBe('2025-09-20');
    expect(albums[2].album_date).toBe('2025-09-10');
  });
});
```

---

#### 3. updateAlbumThumbnail(albumId: string, thumbnailUri: string): Promise<void>

**目的**: アルバムのサムネイル画像を更新

**入力**:
- `albumId: string` - Album UUID
- `thumbnailUri: string` - base64 encoded image data URI

**出力**: Promise<void>

**実装例**:
```javascript
async updateAlbumThumbnail(albumId, thumbnailUri) {
  await this.execute(
    `UPDATE albums SET thumbnail_uri = ?, updated_at = ? WHERE id = ?`,
    [thumbnailUri, new Date().toISOString(), albumId]
  );
}
```

---

#### 4. deleteAlbum(albumId: string): Promise<boolean>

**目的**: アルバムを削除（関連 Photo も削除）

**入力**:
- `albumId: string` - Album UUID

**出力**: Promise<boolean>
- 削除成功: `true`
- 削除対象なし: `false`

**副作用**:
- Foreign Key ON DELETE CASCADE により、関連 Photo もすべて削除

**実装例**:
```javascript
async deleteAlbum(albumId) {
  // 外部キー制約で自動削除
  const result = await this.execute(
    `DELETE FROM albums WHERE id = ?`,
    [albumId]
  );

  return result.changes > 0;
}
```

---

#### 5. getAlbumById(albumId: string): Promise<Album | null>

**目的**: 指定 ID のアルバムを取得

**入力**:
- `albumId: string` - Album UUID

**出力**: Promise<Album | null>
- 見つかった場合: Album オブジェクト
- 見つからない場合: `null`

**実装例**:
```javascript
async getAlbumById(albumId) {
  const result = await this.queryDatabase(
    `SELECT * FROM albums WHERE id = ?`,
    [albumId]
  );
  return result.length > 0 ? result[0] : null;
}
```

---

#### 6. updateAlbumPhotoCount(albumId: string): Promise<void>

**目的**: アルバムの photo_count を現在の関連 Photo 数に更新

**入力**:
- `albumId: string` - Album UUID

**出力**: Promise<void>

**副作用**: Album.photo_count と Album.updated_at を更新

**実装例**:
```javascript
async updateAlbumPhotoCount(albumId) {
  const count = await this.queryDatabase(
    `SELECT COUNT(*) as count FROM photos WHERE album_id = ?`,
    [albumId]
  );

  await this.execute(
    `UPDATE albums SET photo_count = ?, updated_at = ? WHERE id = ?`,
    [count[0].count, new Date().toISOString(), albumId]
  );
}
```

---

## データ整合性の保証

### UNIQUE 制約

```sql
UNIQUE (album_date)
```
- 同一日付のアルバムは 1 つのみ
- 重複作成は DB レベルで拒否

### 外部キー制約

```sql
FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
```
- Album 削除時、関連 Photo は自動削除
- Photo の album_id は必ず存在する Album を参照

### 暗黙的ルール

- `display_order` は 0 から n-1 の連番（ギャップなし）
- `photo_count` は関連 Photo 数と一致（キャッシュ）
- `updated_at` は最終更新時刻（作成時と異なる場合）

---

## パフォーマンス考慮事項

### インデックス

```sql
CREATE INDEX idx_albums_album_date ON albums(album_date);
CREATE INDEX idx_albums_display_order ON albums(display_order);
```

**クエリ最適化**:
- `SELECT BY album_date`: idx_album_date 使用 (< 5ms)
- `SELECT BY display_order`: idx_display_order 使用 (< 5ms)
- `SELECT ALL`: 全テーブルスキャン (< 20ms, 100 アルバムまで)

---

## 相互運用性

### AlbumService.js との連携

- **getAllAlbums()** → `getAllAlbumDates()` を呼び出し
- **updateAlbumOrder()** → `updateAlbumPhotoCount()` で同期

### main.js との連携

- **メインページ表示** → `getAllAlbumDates('display_order')` でレンダリング
- **ドラッグ&ドロップ** → order-persistence.contract の updateAlbumOrder() で更新
