# コントラクト：Order Persistence

**フィーチャー**: フォトアルバムオーガナイザー  
**コンポーネント**: DatabaseService.js  
**日付**: 2025-11-18  
**目的**: 並び順永続化のインタフェース定義（実装とテストの契約）

---

## インタフェース定義

### メソッド仕様

#### 1. updateAlbumOrder(albumIds: string[]): Promise<void>

**目的**: メインページでのドラッグ&ドロップによるアルバム並び替え順序を DB に永続化

**入力**:
- `albumIds: string[]` - 新しい順序の Album ID 配列
  - 例: `['album-uuid-3', 'album-uuid-1', 'album-uuid-2']`

**出力**: Promise<void>

**処理フロー**:
1. 入力の albumIds 配列を検証（UUID 形式、存在確認）
2. 各 albumId に対して display_order を 0, 1, 2, ... n-1 に設定
3. DB に UPDATE クエリで一括反映
4. AlbumOrder テーブル（またはAlbum.display_order）に永続化
5. 成功時は次のメインページ表示時に新しい順序で表示

**エラーハンドリング**:

| エラー | コード | 説明 |
|--------|--------|------|
| 無効なアルバム ID | ERR_INVALID_ALBUM_ID | UUID 形式でない、または存在しない |
| ID 重複 | ERR_DUPLICATE_ALBUM_ID | 同一アルバムが複数回入力 |
| DB エラー | ERR_DB_ERROR | SQL.js エラー |

**実装例**:
```javascript
async updateAlbumOrder(albumIds) {
  // 1. 入力検証
  if (!Array.isArray(albumIds)) {
    throw { code: 'ERR_INVALID_INPUT', message: 'albumIds must be array' };
  }

  // 2. UUID 形式 + 存在確認
  for (const id of albumIds) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw { code: 'ERR_INVALID_ALBUM_ID', message: `Invalid UUID format: ${id}` };
    }

    const exists = await this.queryDatabase(`SELECT id FROM albums WHERE id = ?`, [id]);
    if (exists.length === 0) {
      throw { code: 'ERR_INVALID_ALBUM_ID', message: `Album not found: ${id}` };
    }
  }

  // 3. 重複チェック
  const uniqueIds = new Set(albumIds);
  if (uniqueIds.size !== albumIds.length) {
    throw { code: 'ERR_DUPLICATE_ALBUM_ID', message: 'Duplicate album IDs' };
  }

  // 4. トランザクション開始（シミュレート）
  try {
    // 5. 各アルバムの display_order を更新
    for (let i = 0; i < albumIds.length; i++) {
      await this.execute(
        `UPDATE albums SET display_order = ?, updated_at = ? WHERE id = ?`,
        [i, new Date().toISOString(), albumIds[i]]
      );
    }

    // 6. DB に永続化（localStorage に export）
    await this.saveDatabase();

  } catch (error) {
    throw { code: 'ERR_DB_ERROR', message: error.message };
  }
}
```

**テストケース**:
```javascript
describe('AlbumService.updateAlbumOrder', () => {
  let album1, album2, album3;

  beforeEach(async () => {
    album1 = await db.createOrUpdateAlbum('2025-09-15');
    album2 = await db.createOrUpdateAlbum('2025-09-14');
    album3 = await db.createOrUpdateAlbum('2025-09-13');
    
    // 初期状態: display_order = 0, 1, 2
  });

  it('アルバム並び替え順序を更新', async () => {
    // 新しい順序: album3, album1, album2
    await service.updateAlbumOrder([album3.id, album1.id, album2.id]);

    const updated = await db.getAllAlbumDates('display_order');
    expect(updated[0].id).toBe(album3.id);
    expect(updated[1].id).toBe(album1.id);
    expect(updated[2].id).toBe(album2.id);
  });

  it('display_order が 0, 1, 2 で連番化', async () => {
    await service.updateAlbumOrder([album2.id, album3.id, album1.id]);

    const updated = await db.getAllAlbumDates('display_order');
    expect(updated[0].display_order).toBe(0);
    expect(updated[1].display_order).toBe(1);
    expect(updated[2].display_order).toBe(2);
  });

  it('更新前後で Album ID は変わらない', async () => {
    await service.updateAlbumOrder([album3.id, album1.id, album2.id]);

    const updated = await db.getAlbumById(album1.id);
    expect(updated.id).toBe(album1.id);
  });

  it('無効なアルバム ID を reject', async () => {
    expect(async () => 
      await service.updateAlbumOrder(['invalid-uuid'])
    ).rejects.toThrow('ERR_INVALID_ALBUM_ID');
  });

  it('重複 ID を reject', async () => {
    expect(async () => 
      await service.updateAlbumOrder([album1.id, album1.id, album2.id])
    ).rejects.toThrow('ERR_DUPLICATE_ALBUM_ID');
  });

  it('DB エラーを propagate', async () => {
    // DB を close/破壊
    db.close();
    
    expect(async () => 
      await service.updateAlbumOrder([album1.id])
    ).rejects.toThrow('ERR_DB_ERROR');
  });
});
```

---

#### 2. updatePhotoOrder(photoIds: string[], albumId: string): Promise<void>

**目的**: アルバムビュー内でのドラッグ&ドロップによる写真順序を永続化

**入力**:
- `photoIds: string[]` - 新しい順序の Photo ID 配列
- `albumId: string` - 属するアルバム ID（検証用）

**出力**: Promise<void>

**処理フロー**:
1. 入力検証（UUID 形式、アルバム存在確認）
2. 各 photoId の display_order を 0, 1, 2, ... n-1 に設定
3. DB に UPDATE クエリで反映
4. 成功時は次のアルバムビュー表示時に新しい順序で表示

**エラーハンドリング**:

| エラー | コード | 説明 |
|--------|--------|------|
| 無効なアルバム ID | ERR_INVALID_ALBUM_ID | 存在しない |
| アルバム不一致 | ERR_ALBUM_MISMATCH | Photo がアルバムに属さない |
| Photo ID 不正 | ERR_INVALID_PHOTO_ID | UUID でない、または存在しない |
| DB エラー | ERR_DB_ERROR | SQL.js エラー |

**実装例**:
```javascript
async updatePhotoOrder(photoIds, albumId) {
  // 1. アルバム存在確認
  const album = await this.queryDatabase(`SELECT * FROM albums WHERE id = ?`, [albumId]);
  if (album.length === 0) {
    throw { code: 'ERR_INVALID_ALBUM_ID' };
  }

  // 2. 各 Photo のアルバム所属確認
  for (const photoId of photoIds) {
    const photo = await this.queryDatabase(`SELECT * FROM photos WHERE id = ?`, [photoId]);
    if (photo.length === 0) {
      throw { code: 'ERR_INVALID_PHOTO_ID' };
    }
    if (photo[0].album_id !== albumId) {
      throw { code: 'ERR_ALBUM_MISMATCH' };
    }
  }

  // 3. display_order 更新
  for (let i = 0; i < photoIds.length; i++) {
    await this.execute(
      `UPDATE photos SET display_order = ? WHERE id = ?`,
      [i, photoIds[i]]
    );
  }

  // 4. DB 永続化
  await this.saveDatabase();
}
```

**テストケース**:
```javascript
describe('AlbumService.updatePhotoOrder', () => {
  let album, photo1, photo2, photo3;

  beforeEach(async () => {
    album = await db.createOrUpdateAlbum('2025-09-15');
    photo1 = await db.addPhoto(file1);
    photo2 = await db.addPhoto(file2);
    photo3 = await db.addPhoto(file3);
  });

  it('写真順序を更新', async () => {
    await service.updatePhotoOrder([photo3.id, photo1.id, photo2.id], album.id);

    const photos = await db.getPhotosByDate(album.album_date);
    expect(photos[0].id).toBe(photo3.id);
    expect(photos[1].id).toBe(photo1.id);
    expect(photos[2].id).toBe(photo2.id);
  });

  it('異なるアルバムの Photo を reject', async () => {
    const album2 = await db.createOrUpdateAlbum('2025-09-14');
    const photo4 = await db.addPhoto(file4);  // album2 に属する

    expect(async () =>
      await service.updatePhotoOrder([photo1.id, photo4.id], album.id)
    ).rejects.toThrow('ERR_ALBUM_MISMATCH');
  });
});
```

---

#### 3. saveOrderPersistently(): Promise<void>

**目的**: 現在の DB 状態を localStorage に永続化（定期的な同期）

**入力**: なし

**出力**: Promise<void>

**実装例**:
```javascript
async saveOrderPersistently() {
  const data = this.db.export();  // Uint8Array
  const blob = new Blob([data]);
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = (e) => {
      try {
        const base64 = e.target.result.split(',')[1];
        localStorage.setItem('photoAlbumDB', base64);
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
```

---

## UI/UX 連携

### ドラッグ&ドロップ フロー

**メインページ (アルバム並び替え)**:

```javascript
// HTML
<div id="album-grid" class="album-grid">
  <div class="album-card" draggable="true" data-album-id="album-1">...</div>
  <div class="album-card" draggable="true" data-album-id="album-2">...</div>
</div>

// JavaScript (main.js)
const albumGrid = document.getElementById('album-grid');

albumGrid.addEventListener('dragstart', (e) => {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('application/json', JSON.stringify({
    albumId: e.target.dataset.albumId
  }));
});

albumGrid.addEventListener('drop', async (e) => {
  e.preventDefault();
  
  const data = JSON.parse(e.dataTransfer.getData('application/json'));
  const newOrder = calculateNewOrder(albumGrid, data.albumId);
  
  // updateAlbumOrder() 呼び出し
  await albumService.updateAlbumOrder(newOrder);
  
  // UI 再レンダリング
  renderAlbums();
});
```

**アルバムビュー (写真順序変更)**:

```javascript
// 同様のドラッグ&ドロップハンドラ
tileGrid.addEventListener('drop', async (e) => {
  const newPhotoOrder = calculateNewPhotoOrder(tileGrid);
  await albumService.updatePhotoOrder(newPhotoOrder, currentAlbumId);
  renderTiles();
});
```

---

## パフォーマンス & 信頼性

### レート制限

- ドラッグ&ドロップ毎に DB 更新（即座）
- save() は 1 秒ごとにバッチ処理（optional）

### 復旧戦略

- アプリクローズ時: DB は localStorage に永続化
- アプリ再起動時: localStorage から DB をリロード
- 順序データ破損時: 新規アルバムを割り当てる

---

## テストカバレッジ

| テストタイプ | 項目 | 期待値 |
|-------------|------|--------|
| Unit | 入力検証 | 100% |
| Unit | エラーハンドリング | 100% |
| Integration | UI と DB の同期 | > 90% |
| Integration | ドラッグ&ドロップ フロー | > 85% |
