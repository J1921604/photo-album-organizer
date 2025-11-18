# ストレージコントラクト：Photo Storage

**フィーチャー**: フォトアルバムオーガナイザー  
**コンポーネント**: DatabaseService.js  
**日付**: 2025-11-18  
**目的**: Photo エンティティの永続化インタフェースを定義、実装と テストの双方が満たすべき要件を明文化

---

## インタフェース定義

### 概要

DatabaseService は sql.js を用いてクライアント側の localStorage に Photo テーブルを保持し、Photo オブジェクトの CRUD 操作を提供する。

### メソッド仕様

#### 1. addPhoto(file: File, exifData?: object): Promise<Photo>

**目的**: ファイルオブジェクトから Photo エンティティを生成し、DB に保存

**入力**:
- `file: File` - HTML `<input type="file">` または Drag&Drop から取得した File オブジェクト
  - 必須属性: `name`, `size`, `type`, `lastModified`
  - 型チェック: `file instanceof File === true`
- `exifData?: object` (オプション) - 抽出済みの EXIF メタデータ
  - 例: `{ Make: 'Apple', Model: 'iPhone 14', DateTime: '2025:09:15 14:30:45' }`

**出力**: Promise<Photo>
```typescript
{
  id: string;          // UUID (自動生成)
  file_name: string;   // ファイル名
  file_size: number;   // バイト数
  photo_date: string;  // YYYY-MM-DD (EXIF DateTime から抽出)
  photo_time: string;  // HH:MM:SS (EXIF DateTime から抽出)
  mime_type: string;   // file.type
  data_uri: string;    // base64 encoded image data
  checksum: string;    // MD5 ハッシュ
  exif_data: any;      // EXIF メタデータ JSON
  created_at: string;  // ISO 8601 timestamp
  album_id: string;    // UUID (自動割り当て)
  display_order: number; // 初期値 0
}
```

**エラーハンドリング**:

| エラー | コード | HTTPステータス | 説明 |
|--------|--------|----------------|------|
| 無効なファイル型 | ERR_INVALID_MIME_TYPE | 400 | image/jpeg/png/webp 以外 |
| ファイルサイズ超過 | ERR_INVALID_FILE_SIZE | 400 | > 50MB または < 100B |
| 重複ファイル | ERR_DUPLICATE_FILE | 409 | 同一 checksum 既存 |
| DB エラー | ERR_DB_ERROR | 500 | SQL.js エラー |
| メタデータ抽出失敗 | ERR_METADATA_EXTRACTION_FAILED | 400 | EXIF 解析不可 |

**実装例**:
```javascript
async addPhoto(file, exifData = null) {
  // 1. ファイル検証
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw { code: 'ERR_INVALID_MIME_TYPE', message: `Unsupported type: ${file.type}` };
  }
  if (file.size < 100 || file.size > 50 * 1024 * 1024) {
    throw { code: 'ERR_INVALID_FILE_SIZE', message: `Size out of range: ${file.size}` };
  }

  // 2. base64 data URI に変換
  const dataUri = await fileToDataURI(file);

  // 3. checksum (MD5) 計算
  const checksum = md5(file);

  // 4. 重複チェック
  const existing = await this.queryDatabase(`SELECT id FROM photos WHERE checksum = ?`, [checksum]);
  if (existing.length > 0) {
    throw { code: 'ERR_DUPLICATE_FILE' };
  }

  // 5. EXIF メタデータ抽出
  const photoDate = exifData?.DateTime || new Date().toISOString().split('T')[0];
  const photoTime = exifData?.DateTime?.split(' ')[1] || '00:00:00';

  // 6. DB に INSERT
  const photo = {
    id: generateUUID(),
    file_name: file.name,
    file_size: file.size,
    photo_date: photoDate,
    photo_time: photoTime,
    mime_type: file.type,
    data_uri: dataUri,
    checksum,
    exif_data: exifData,
    created_at: new Date().toISOString(),
    album_id: this.getOrCreateAlbumIdForDate(photoDate),
    display_order: 0
  };

  await this.execute(
    `INSERT INTO photos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    Object.values(photo)
  );

  return photo;
}
```

**テストケース**:
```javascript
describe('DatabaseService.addPhoto', () => {
  it('有効な JPEG ファイルを追加', async () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const photo = await db.addPhoto(file);
    expect(photo.id).toBeDefined();
    expect(photo.mime_type).toBe('image/jpeg');
  });

  it('無効な MIME 型を reject', async () => {
    const file = new File(['data'], 'file.exe', { type: 'application/exe' });
    expect(async () => await db.addPhoto(file)).rejects.toThrow('ERR_INVALID_MIME_TYPE');
  });

  it('51MB ファイルを reject', async () => {
    const largeData = new Uint8Array(51 * 1024 * 1024);
    const file = new File([largeData], 'large.jpg', { type: 'image/jpeg' });
    expect(async () => await db.addPhoto(file)).rejects.toThrow('ERR_INVALID_FILE_SIZE');
  });

  it('重複ファイルを reject', async () => {
    const file1 = new File(['same data'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['same data'], 'photo2.jpg', { type: 'image/jpeg' });
    
    await db.addPhoto(file1);
    expect(async () => await db.addPhoto(file2)).rejects.toThrow('ERR_DUPLICATE_FILE');
  });

  it('EXIF DateTime をパース', async () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const exifData = { DateTime: '2025:09:15 14:30:45' };
    const photo = await db.addPhoto(file, exifData);
    expect(photo.photo_date).toBe('2025-09-15');
    expect(photo.photo_time).toBe('14:30:45');
  });
});
```

---

#### 2. getPhotosByDate(date: string): Promise<Photo[]>

**目的**: 指定日付の写真リストを取得（アルバムビュー表示用）

**入力**:
- `date: string` - ISO 8601 date 形式 (YYYY-MM-DD)

**出力**: Promise<Photo[]>
- 指定日付に一致する Photo オブジェクトの配列
- 配列は `display_order` ASC でソート済み
- 該当なしの場合は空配列 `[]` を返す

**エラーハンドリング**:

| エラー | コード | 説明 |
|--------|--------|------|
| 無効な日付形式 | ERR_INVALID_DATE_FORMAT | YYYY-MM-DD 形式でない |
| DB エラー | ERR_DB_ERROR | SQL.js エラー |

**実装例**:
```javascript
async getPhotosByDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw { code: 'ERR_INVALID_DATE_FORMAT' };
  }

  const result = await this.queryDatabase(
    `SELECT * FROM photos WHERE photo_date = ? ORDER BY display_order ASC`,
    [date]
  );

  return result || [];
}
```

**テストケース**:
```javascript
describe('DatabaseService.getPhotosByDate', () => {
  beforeEach(async () => {
    await db.addPhoto(file1);  // 2025-09-15
    await db.addPhoto(file2);  // 2025-09-15
    await db.addPhoto(file3);  // 2025-09-16
  });

  it('指定日付の写真リストを取得', async () => {
    const photos = await db.getPhotosByDate('2025-09-15');
    expect(photos).toHaveLength(2);
    expect(photos[0].photo_date).toBe('2025-09-15');
  });

  it('該当なしで空配列を返す', async () => {
    const photos = await db.getPhotosByDate('2025-01-01');
    expect(photos).toEqual([]);
  });

  it('display_order でソート', async () => {
    const photos = await db.getPhotosByDate('2025-09-15');
    expect(photos[0].display_order).toBeLessThanOrEqual(photos[1].display_order);
  });

  it('無効な日付形式を reject', async () => {
    expect(async () => await db.getPhotosByDate('2025/09/15')).rejects.toThrow();
  });
});
```

---

#### 3. deletePhoto(id: string): Promise<boolean>

**目的**: 指定 ID の写真を削除

**入力**:
- `id: string` - Photo UUID

**出力**: Promise<boolean>
- 削除成功: `true`
- 削除対象なし: `false` (エラーではなく false を返す)

**副作用**:
- Album の `photo_count` を -1 更新
- 同アルバムの最後の写真削除時は Album も削除

**実装例**:
```javascript
async deletePhoto(id) {
  const photo = await this.queryDatabase(
    `SELECT album_id FROM photos WHERE id = ?`,
    [id]
  );

  if (photo.length === 0) return false;

  const albumId = photo[0].album_id;

  // Photo 削除
  await this.execute(`DELETE FROM photos WHERE id = ?`, [id]);

  // Album photo_count 更新
  const count = await this.queryDatabase(
    `SELECT COUNT(*) as count FROM photos WHERE album_id = ?`,
    [albumId]
  );

  if (count[0].count === 0) {
    // アルバムが空になったら削除
    await this.execute(`DELETE FROM albums WHERE id = ?`, [albumId]);
  } else {
    await this.execute(
      `UPDATE albums SET photo_count = ? WHERE id = ?`,
      [count[0].count, albumId]
    );
  }

  return true;
}
```

**テストケース**:
```javascript
describe('DatabaseService.deletePhoto', () => {
  it('写真を削除', async () => {
    const photo = await db.addPhoto(file);
    const result = await db.deletePhoto(photo.id);
    expect(result).toBe(true);

    const deleted = await db.queryDatabase(`SELECT * FROM photos WHERE id = ?`, [photo.id]);
    expect(deleted).toEqual([]);
  });

  it('削除対象なしで false を返す', async () => {
    const result = await db.deletePhoto('non-existent-id');
    expect(result).toBe(false);
  });

  it('最後の写真削除時、Album も削除', async () => {
    const photo = await db.addPhoto(file);
    const albumId = photo.album_id;

    await db.deletePhoto(photo.id);

    const album = await db.queryDatabase(`SELECT * FROM albums WHERE id = ?`, [albumId]);
    expect(album).toEqual([]);
  });
});
```

---

#### 4. updatePhotoOrder(photos: Photo[]): Promise<void>

**目的**: 同アルバム内の写真順序を更新（ドラッグ&ドロップ後）

**入力**:
- `photos: Photo[]` - 新しい順序の Photo 配列（display_order フィールドは無視）

**出力**: Promise<void> (void を返す)

**副作用**:
- 各 Photo の `display_order` を配列インデックスで更新
- Album の `updated_at` を現在時刻に更新

**実装例**:
```javascript
async updatePhotoOrder(photos) {
  for (let i = 0; i < photos.length; i++) {
    await this.execute(
      `UPDATE photos SET display_order = ? WHERE id = ?`,
      [i, photos[i].id]
    );
  }

  if (photos.length > 0) {
    const albumId = photos[0].album_id;
    await this.execute(
      `UPDATE albums SET updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), albumId]
    );
  }
}
```

**テストケース**:
```javascript
describe('DatabaseService.updatePhotoOrder', () => {
  it('写真順序を更新', async () => {
    const photos = [
      await db.addPhoto(file1),
      await db.addPhoto(file2),
      await db.addPhoto(file3)
    ];

    // 順序を逆順に
    const reversed = [photos[2], photos[1], photos[0]];
    await db.updatePhotoOrder(reversed);

    const updated = await db.getPhotosByDate(photos[0].photo_date);
    expect(updated[0].id).toBe(photos[2].id);
    expect(updated[2].id).toBe(photos[0].id);
  });
});
```

---

## データサイクルの保証

### トランザクション

SQL.js は真のトランザクション機能がないため、以下で原子性をシミュレート:

```javascript
async addPhotoWithTransaction(file, exifData) {
  try {
    this.beginTransaction();

    const photo = await this.addPhoto(file, exifData);

    this.commit();
    return photo;
  } catch (error) {
    this.rollback();
    throw error;
  }
}
```

### キャッシュ戦略

- **読み取り**: DB から直接フェッチ（毎回クエリ）
- **書き込み**: DB 更新後、メモリキャッシュをリセット（次クエリでリロード）
- **永続化**: DB export → base64 → localStorage に定期的に保存

---

## 相互運用性

### 他コンポーネントとの連携

- **AlbumService.groupPhotosByDate()** → `getPhotosByDate()` を使用
- **main.js の UI レンダリング** → `getPhotosByDate()` で写真リストを取得
- **ドラッグ&ドロップハンドラ** → `updatePhotoOrder()` で順序更新
