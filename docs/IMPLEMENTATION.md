# フォトアルバムオーガナイザー 実装詳細書

このドキュメントは、他のAIエンジニアが本プロジェクトを完全に再現・拡張できるように、全実装詳細を記載しています。

**バージョン**: 1.0.0  
**DBバージョン**: 9  
**最終更新**: 2025-11-18  
**テスト状況**: 77/77 PASS (100%)

---

## 最新アップデート (v9)

### データベーススキーマ更新
- **複合キー導入**: `UNIQUE(album_date, album_title)` により同じ日付に複数アルバム作成可能
- **album_id基盤**: 写真の所属をalbum_idで管理（日付ではなく）
- **バイナリストレージ分離**: IndexedDBに写真本体、Data URIはプレビューのみ

### 新機能
- 同じ日付に異なるタイトルのアルバムを複数作成可能
- アルバム名変更機能（同じ日付の他アルバムと独立）
- album_idによる写真の完全分離（同じ日付でも混在しない）
- レガシースキーマからの自動マイグレーション

### テスト追加
- SameDateAlbum.test.js (4テスト) - 複数アルバム作成・写真分離
- AlbumRename.test.js (2テスト) - 独立したアルバム名変更
- ThumbnailFix.test.js (2テスト) - album_id基盤サムネイル管理

---

## 1. ファイル構成と責務

### src/main.js (1,331 行)

**責務**: アプリケーションのメインロジック、UI 管理、状態管理

**主要セクション**:

#### 1.1 初期化 (100-200行)
```javascript
// グローバル状態
const state = {
  albums: [],
  currentAlbumDate: null,
  sortBy: 'date',        // 'date' | 'title'
  sortOrder: 'asc',      // 'asc' | 'desc'
  currentPhotoIndex: 0,
  currentPhoto: null
}

// UI 要素キャッシュ
const ui = {
  uploadInput: document.getElementById('photo-upload'),
  albumContainer: document.getElementById('album-container'),
  mainPage: document.getElementById('main-page'),
  photoPage: document.getElementById('photo-page'),
  // ... その他要素
}

// 初期化処理
async function initialize() {
  try {
    await DatabaseService.initDatabase()
    state.albums = await AlbumService.getAllAlbums()
    renderAlbums()
    attachEventListeners()
    info('初期化完了')
  } catch (err) {
    error('初期化エラー', err)
  }
}
```

#### 1.2 ファイルアップロード処理 (300-500行)
```javascript
async function handleFileUpload(files) {
  for (const file of files) {
    try {
      // 1. ファイル検証
      validateFile(file)
      
      // 2. Base64 エンコード
      const dataUri = await fileToDataUri(file)
      
      // 3. EXIF 抽出
      const exifData = await extractExifData(file)
      
      // 4. DB に保存
      await DatabaseService.addPhoto(file, dataUri, exifData)
      
      // 5. グループ化
      state.albums = await AlbumService.getAllAlbums()
      
    } catch (err) {
      error('アップロードエラー', err)
      showErrorNotification(err.message)
    }
  }
  
  renderAlbums()
}
```

#### 1.3 アルバムレンダリング (600-700行)
```javascript
function renderAlbums() {
  // 1. ソート
  const sortedAlbums = sortAlbums(state.albums, state.sortBy, state.sortOrder)
  
  // 2. HTML 生成
  const html = sortedAlbums.map(album => `
    <div class="album-card" draggable="false" data-album-id="${album.id}">
      <div class="album-thumbnail">
        ${album.thumbnail_uri ? 
          `<img src="${album.thumbnail_uri}" alt="..." loading="lazy">` :
          '<div class="album-placeholder">サムネイル未設定</div>'}
      </div>
      <div class="album-info">
        <h3>${escapeHtml(album.album_title || album.album_date)}</h3>
        <p>${album.photo_count}枚</p>
      </div>
    </div>
  `).join('')
  
  // 3. DOM 更新
  ui.albumContainer.innerHTML = html
  
  // 4. イベントリスナー再設定
  document.querySelectorAll('.album-card').forEach(card => {
    card.addEventListener('click', () => showPhotoPage(card.dataset.albumId))
  })
}
```

#### 1.4 ソート機能 (207-221行)
```javascript
if (ui.sortSelect) {
  ui.sortSelect.addEventListener('change', (event) => {
    state.sortBy = event.target.value  // 'date' | 'title'
    loadAlbums()
  })
}

if (ui.sortOrderBtn) {
  ui.sortOrderBtn.addEventListener('click', (event) => {
    event.preventDefault()
    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
    
    // UI 更新
    if (ui.sortOrderBtn.classList.contains('desc')) {
      ui.sortOrderBtn.classList.remove('desc')
    } else {
      ui.sortOrderBtn.classList.add('desc')
    }
    
    loadAlbums()
  })
}

function sortAlbums(albums, sortBy, sortOrder) {
  const sorted = [...albums]
  
  if (sortBy === 'date') {
    sorted.sort((a, b) => {
      const result = new Date(a.album_date) - new Date(b.album_date)
      return sortOrder === 'asc' ? result : -result
    })
  } else if (sortBy === 'title') {
    sorted.sort((a, b) => {
      const titleA = (a.album_title || a.album_date).toLowerCase()
      const titleB = (b.album_title || b.album_date).toLowerCase()
      const result = titleA.localeCompare(titleB)
      return sortOrder === 'asc' ? result : -result
    })
  }
  
  return sorted
}
```

#### 1.5 ドラッグ&ドロップ無効化 (625行)
```javascript
// アルバムカード HTML テンプレート
return `
  <div class="album-card" draggable="false" data-album-id="${album.id}">
    <!-- ... -->
  </div>
`

// 注釈:
// - draggable="false" 属性により、全ブラウザでドラッグ禁止
// - dragstart イベントリスナーは削除済み
// - drop ハンドラー削除済み
// - マウスダウン時のドラッグ開始処理は実装されていない
```

#### 1.6 フォトビューページ (800-1000行)
```javascript
async function showPhotoPage(albumId) {
  try {
    // 1. アルバムデータ取得
    const album = state.albums.find(a => a.id == albumId)
    state.currentAlbumDate = album.album_date
    
    // 2. 写真取得
    const photos = await DatabaseService.getPhotosByDate(album.album_date)
    
    // 3. タイル表示
    const tileHtml = photos.map((photo, idx) => `
      <div class="tile-item" data-photo-id="${photo.id}">
        <img src="${photo.data_uri}" alt="..." loading="lazy">
      </div>
    `).join('')
    
    ui.photoGrid.innerHTML = tileHtml
    
    // 4. ページ切り替え
    showMainPage()  // 実質的には非表示にして photoPage を表示
    state.currentPage = 'photo'
    
  } catch (err) {
    error('フォトページ読込エラー', err)
  }
}
```

#### 1.7 ダウンロード機能 (1100-1150行)
```javascript
function downloadCurrentPhoto() {
  if (!state.currentPhoto) return
  
  try {
    // 1. data URI → Blob 変換
    const arr = state.currentPhoto.data_uri.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const str = atob(arr[1])
    const n = str.length
    const u8arr = new Uint8Array(n)
    
    for (let i = 0; i < n; i++) {
      u8arr[i] = str.charCodeAt(i)
    }
    
    const blob = new Blob([u8arr], { type: mime })
    
    // 2. Blob URL 生成
    const url = URL.createObjectURL(blob)
    
    // 3. ダウンロード実行
    const a = document.createElement('a')
    a.href = url
    a.download = state.currentPhoto.file_name
    a.click()
    
    // 4. クリーンアップ
    setTimeout(() => URL.revokeObjectURL(url), 100)
    
  } catch (err) {
    error('ダウンロードエラー', err)
  }
}
```

#### 1.8 イベントリスナー設定 (1200-1331行)
```javascript
function attachEventListeners() {
  // アップロード
  ui.uploadInput.addEventListener('change', async (e) => {
    await handleFileUpload(Array.from(e.target.files))
  })
  
  // ドラッグ&ドロップ（ファイルアップロード用）
  ui.mainPage.addEventListener('dragover', (e) => {
    e.preventDefault()
    ui.mainPage.classList.add('drag-over')
  })
  
  ui.mainPage.addEventListener('drop', async (e) => {
    e.preventDefault()
    ui.mainPage.classList.remove('drag-over')
    await handleFileUpload(Array.from(e.dataTransfer.files))
  })
  
  // ソート
  if (ui.sortSelect) {
    ui.sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value
      loadAlbums()
    })
  }
  
  // バックボタン
  ui.backBtn.addEventListener('click', showMainPage)
  
  // ダウンロード
  ui.downloadBtn.addEventListener('click', downloadCurrentPhoto)
}
```

---

### src/services/DatabaseService.js (1,268 行)

**責務**: SQL.js を使用した DB 操作、localStorage 永続化

#### 主要クラスメソッド

```javascript
class DatabaseService {
  // DB 初期化
  static async initDatabase() {
    if (this.db) return
    
    // 1. SQL.js WASM 初期化
    const SQL = await initSqlJs()
    
    // 2. localStorage から DB ロード
    let data = localStorage.getItem('photoAlbumDb')
    
    if (data) {
      const binaryString = atob(data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      this.db = new SQL.Database(bytes)
    } else {
      // 新規 DB 作成
      this.db = new SQL.Database()
      this.createTables()
    }
  }
  
  // テーブル作成 (DBバージョン9)
  static createTables() {
    // Photos テーブル
    this.db.run(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        photo_date TEXT NOT NULL,            -- YYYY-MM-DD
        preview_uri TEXT,                     -- プレビュー画像 Data URI
        storage_key TEXT,                     -- IndexedDB バイナリストレージキー
        mime_type TEXT,                       -- 'image/jpeg', 'image/png', 'image/webp'
        album_id INTEGER,                     -- 所属アルバムID (NULL可)
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
      )
    `)
    
    // Albums テーブル
    this.db.run(`
      CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        album_date TEXT NOT NULL,             -- YYYY-MM-DD
        display_order INTEGER NOT NULL,
        album_title TEXT NOT NULL DEFAULT '', -- アルバム名（空文字可）
        thumbnail_uri TEXT,                   -- サムネイル Data URI
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(album_date, album_title)       -- 複合キー: 同じ日付に異なるタイトルのアルバムを許可
      )
    `)
    
    // Metadata テーブル (バージョン管理)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    
    // インデックス
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_photos_date ON photos(photo_date)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_photos_storage_key ON photos(storage_key)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_albums_order ON albums(display_order)`)
    
    // DBバージョンを設定
    this.db.run(`INSERT OR REPLACE INTO metadata (key, value) VALUES ('db_version', '9')`)
  }
  
  // 写真追加
  static async addPhoto(file, dataUri, exifData) {
    const photoDate = extractDate(exifData) || new Date(file.lastModified).toISOString().split('T')[0]
    const checksum = await calculateMD5(dataUri)
    
    const stmt = this.db.prepare(`
      INSERT INTO photos 
      (file_name, file_size, photo_date, mime_type, data_uri, checksum, exif_data, created_at, album_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.bind([
      file.name,
      file.size,
      photoDate,
      file.type,
      dataUri,
      checksum,
      JSON.stringify(exifData),
      new Date().toISOString(),
      null
    ])
    
    stmt.step()
    stmt.free()
    
    await this.saveDatabase()
    return photoDate
  }
  
  // 日付別写真取得
  static async getPhotosByDate(date) {
    const stmt = this.db.prepare(`
      SELECT * FROM photos WHERE photo_date = ? ORDER BY display_order, created_at
    `)
    
    stmt.bind([date])
    
    const results = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    
    return results
  }
  
  // アルバム作成/更新
  static async createOrUpdateAlbum(date, title = null) {
    const photos = await this.getPhotosByDate(date)
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO albums 
      (album_date, album_title, photo_count, display_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    stmt.bind([
      date,
      title,
      photos.length,
      0,
      new Date().toISOString(),
      new Date().toISOString()
    ])
    
    stmt.step()
    stmt.free()
    
    await this.saveDatabase()
  }
  
  // アルバム順序更新
  static async updateAlbumOrder(albumIds) {
    for (let i = 0; i < albumIds.length; i++) {
      const stmt = this.db.prepare(`
        UPDATE albums SET display_order = ? WHERE id = ?
      `)
      stmt.bind([i, albumIds[i]])
      stmt.step()
      stmt.free()
    }
    
    await this.saveDatabase()
  }
  
  // DB 保存
  static async saveDatabase() {
    const data = this.db.export()
    const binary = String.fromCharCode.apply(null, data)
    const encoded = btoa(binary)
    localStorage.setItem('photoAlbumDb', encoded)
  }
}
```

---

### src/services/AlbumService.js (280 行)

**責務**: アルバムのビジネスロジック、グループ化、ソート

#### 主要メソッド

```javascript
// 日付別グループ化
function groupPhotosByDate(photos) {
  const groups = {}
  
  for (const photo of photos) {
    if (!groups[photo.photo_date]) {
      groups[photo.photo_date] = []
    }
    groups[photo.photo_date].push(photo)
  }
  
  // 日付でソート (新しい順)
  return Object.entries(groups)
    .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
    .map(([date, photos]) => ({
      album_date: date,
      photos: photos,
      photo_count: photos.length,
      display_order: 0
    }))
}

// 全アルバム取得
async function getAllAlbums() {
  const photos = await DatabaseService.getAllPhotos()
  const grouped = groupPhotosByDate(photos)
  
  // 各グループについてアルバムレコード作成
  for (const group of grouped) {
    await DatabaseService.createOrUpdateAlbum(group.album_date)
  }
  
  // DB から全アルバム取得
  const stmt = DatabaseService.db.prepare(`
    SELECT * FROM albums ORDER BY display_order, album_date DESC
  `)
  
  const albums = []
  while (stmt.step()) {
    const album = stmt.getAsObject()
    
    // サムネイル設定
    const photos = await DatabaseService.getPhotosByDate(album.album_date)
    if (photos.length > 0) {
      album.thumbnail_uri = photos[0].data_uri
    }
    
    albums.push(album)
  }
  stmt.free()
  
  return albums
}

// アルバム順序更新
async function updateAlbumOrder(albumIds) {
  await DatabaseService.updateAlbumOrder(albumIds)
}

// 手動アルバム作成
async function createManualAlbum(date, title) {
  await DatabaseService.createOrUpdateAlbum(date, title)
}
```

---

### src/utils/ ユーティリティ

#### dateUtils.js
```javascript
// YYYY-MM-DD 形式の日付を人間が読める形式に変換
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// EXIF DateTime から日付抽出
function extractDateFromExif(exifData) {
  if (!exifData || !exifData.DateTime) return null
  
  // EXIF 形式: "2025:11:15 14:30:45"
  const parts = exifData.DateTime.split(' ')
  const dateParts = parts[0].split(':')
  
  return `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`
}
```

#### fileValidation.js
```javascript
// ファイル検証
function validateFile(file) {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
  
  if (!allowedMimes.includes(file.type)) {
    throw new Error('ERR_INVALID_MIME_TYPE: ' + file.type)
  }
  
  if (file.size < 100 || file.size > 50 * 1024 * 1024) {
    throw new Error(`ERR_INVALID_FILE_SIZE: ${file.size}`)
  }
  
  return true
}

// Base64 エンコード
async function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

#### security.js
```javascript
// HTML エスケープ
function escapeHtml(text) {
  if (!text) return ''
  
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// XSS 対策済み innerHTML
function setInnerHTML(element, html) {
  element.textContent = ''
  const template = document.createElement('template')
  template.innerHTML = html
  element.appendChild(template.content.cloneNode(true))
}
```

#### logger.js
```javascript
function info(message, ...args) {
  console.log('[INFO]', message, ...args)
}

function error(message, err) {
  console.error('[ERROR]', message, err)
}

function warn(message, ...args) {
  console.warn('[WARN]', message, ...args)
}
```

---

## 2. HTML 構造 (src/index.html)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>フォトアルバムオーガナイザー</title>
  <link rel="stylesheet" href="./styles/main.css">
</head>
<body>
  <div id="app">
    <!-- メインページ -->
    <div id="main-page" class="page active">
      <header>
        <h1>フォトアルバムオーガナイザー</h1>
        
        <!-- ソート コントロール -->
        <div class="sort-controls">
          <select id="sort-select">
            <option value="date">日付順</option>
            <option value="title">名前順</option>
          </select>
          <button id="sort-order-btn" title="並び順を切り替え">↑</button>
        </div>
      </header>
      
      <!-- アップロード領域 -->
      <div id="upload-area" class="upload-area">
        <input id="photo-upload" type="file" accept="image/*" multiple>
        <p>ここにファイルをドラッグ&ドロップするか、クリック</p>
      </div>
      
      <!-- アルバムコンテナ -->
      <div id="album-container" class="album-grid"></div>
    </div>
    
    <!-- フォトページ -->
    <div id="photo-page" class="page">
      <header>
        <button id="back-btn">← 戻る</button>
        <h2 id="album-title"></h2>
      </header>
      
      <!-- 写真グリッド -->
      <div id="photo-grid" class="tile-grid"></div>
      
      <!-- フルサイズモーダル -->
      <div id="fullsize-modal" class="modal">
        <button class="modal-close">✕</button>
        <div class="modal-content">
          <img id="fullsize-img" src="" alt="">
        </div>
        <div class="modal-controls">
          <button id="download-btn">ダウンロード</button>
        </div>
      </div>
    </div>
  </div>
  
  <script type="module" src="./main.js"></script>
</body>
</html>
```

---

## 3. CSS 構造

### main.css
```css
:root {
  --primary: #1976d2;
  --danger: #d32f2f;
  --text: #333;
  --bg: #f5f5f5;
}

* {
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  margin: 0;
  padding: 0;
  background: var(--bg);
}

.page {
  display: none;
}

.page.active {
  display: block;
}
```

### components.css
```css
.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
  padding: 16px;
}

.album-card {
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
}

.album-card:hover {
  transform: scale(1.05);
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  padding: 8px;
}
```

### responsive.css
```css
@media (max-width: 768px) {
  .album-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}

@media (max-width: 480px) {
  .album-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

## 4. テスト構成

### Unit Tests (34 tests)

#### tests/unit/dateUtils.test.js (12)
```javascript
describe('dateUtils', () => {
  test('YYYY-MM-DD から日本語日付に変換', () => {
    const result = formatDate('2025-11-15')
    expect(result).toContain('2025')
    expect(result).toContain('11月')
    expect(result).toContain('15日')
  })
  
  test('EXIF DateTime から日付抽出', () => {
    const exif = { DateTime: '2025:11:15 14:30:45' }
    const result = extractDateFromExif(exif)
    expect(result).toBe('2025-11-15')
  })
  
  // ... その他 10 テスト
})
```

#### tests/unit/fileValidation.test.js (13)
```javascript
describe('fileValidation', () => {
  test('JPEG ファイル検証 成功', () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    expect(() => validateFile(file)).not.toThrow()
  })
  
  test('無効な MIME type 拒否', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    expect(() => validateFile(file)).toThrow('ERR_INVALID_MIME_TYPE')
  })
  
  // ... その他 11 テスト
})
```

#### tests/unit/AlbumService.test.js (9)
```javascript
describe('AlbumService', () => {
  test('日付別グループ化', () => {
    const photos = [
      { photo_date: '2025-11-15', id: 1 },
      { photo_date: '2025-11-15', id: 2 },
      { photo_date: '2025-11-14', id: 3 }
    ]
    
    const result = groupPhotosByDate(photos)
    expect(result.length).toBe(2)
    expect(result[0].album_date).toBe('2025-11-15')
  })
  
  // ... その他 8 テスト
})
```

### Contract Tests (15 tests)

#### tests/contract/DatabaseService.contract.test.js (15)
```javascript
describe('DatabaseService Contract', () => {
  beforeEach(async () => {
    await DatabaseService.initDatabase()
  })
  
  test('addPhoto 後に getPhotosByDate で取得可能', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    const date = await DatabaseService.addPhoto(file, 'data:...', {})
    
    const photos = await DatabaseService.getPhotosByDate(date)
    expect(photos.length).toBeGreaterThan(0)
  })
  
  // ... その他 14 テスト
})
```

### Integration Tests (28 tests)

#### tests/integration/PhotoUploadIntegration.test.js (8)
```javascript
describe('Photo Upload Integration', () => {
  test('写真アップロード → グループ化 → 表示', async () => {
    // 1. ファイル準備
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    
    // 2. アップロード処理
    await handleFileUpload([file])
    
    // 3. 検証
    expect(state.albums.length).toBeGreaterThan(0)
  })
  
  // ... その他 7 テスト
})
```

---

## 5. ビルド・デプロイメント設定

### vite.config.js
```javascript
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/photo-album-organizer/',
  
  build: {
    outDir: '../dist',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('sql.js')) return 'sql.js'
        }
      }
    }
  },
  
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
})
```

### .github/workflows/deploy.yml
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          force_orphan: true
          cname: ''
```

---

## 6. パフォーマンス最適化

### バンドルサイズ最適化

- SQL.js 手動チャンク分離
- CSS ミニ化
- JavaScript Terser ミニ化

### メモリ管理

- Blob URL 即座に revokeObjectURL
- 大量画像時の遅延読込
- 不要な DOM 保持を避ける

### DB 最適化

- インデックス活用（photo_date, album_id, display_order）
- SQL クエリ最小化
- base64 エンコーディング効率化

---

## 7. 既知の制限事項

1. **localStorage 容量制限**: 通常 5-10MB
   - 解決: 画像圧縮、古いアルバム削除

2. **EXIF メタデータ不完全**: 全ファイル形式で抽出不可
   - 解決: lastModified フィールド使用

3. **クロスオリジン制限**: GitHub Pages でローカルファイル読込み不可
   - 解決: ユーザーがファイルを選択してアップロード

---

## 8. 拡張ポイント

### 機能追加例

1. **タグ機能**
   ```javascript
   // tags テーブル追加
   CREATE TABLE tags (
     id INTEGER PRIMARY KEY,
     photo_id INTEGER,
     tag_name TEXT,
     FOREIGN KEY (photo_id) REFERENCES photos(id)
   )
   ```

2. **フィルター機能**
   ```javascript
   function filterPhotosByTag(photoIds, tagName) {
     // tag_name で写真フィルター
   }
   ```

3. **写真編集機能**
   ```javascript
   function applyFilter(photoDataUri, filterType) {
     // Canvas で画像フィルター適用
   }
   ```
