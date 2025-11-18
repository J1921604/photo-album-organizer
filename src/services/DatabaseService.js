/**
 * データベースサービス（SQL.js使用）
 */

import initSqlJs from 'sql.js'
import { info, error, warn } from '../utils/logger.js'
import { loadDatabaseSnapshot, saveDatabaseSnapshot } from './DatabasePersistence.js'

const LEGACY_STORAGE_KEY = 'photo-album-organizer-db'
const DB_VERSION = 9

let db = null
let sqlJs = null
let isInitialized = false

function ensureDatabaseInitialized() {
  if (!db) {
    throw new Error('Database has not been initialized. Call initDatabase() first.')
  }
}

function ensureDatabaseReady() {
  ensureDatabaseInitialized()
  if (!isInitialized) {
    throw new Error('Database initialization is not complete. Call initDatabase() first.')
  }

  if (typeof indexedDB === 'undefined') {
    try {
      const hasSnapshot = typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_STORAGE_KEY)
      if (!hasSnapshot) {
        throw new Error('Database persistence has been cleared. Re-run initDatabase() before using the service.')
      }
    } catch (storageError) {
      throw new Error('Database persistence layer is unavailable. Re-run initDatabase().')
    }
  }
}

/**
 * データベースを初期化
 * @returns {Promise<void>}
 */
export async function initDatabase() {
  try {
    isInitialized = false
    // sql.js を初期化（CDN から WASM をロード）
    sqlJs = await initSqlJs({
      locateFile: resolveSqlWasmPath
    })
    
    // 既存スナップショットを読み込み
    const savedDb = await loadDatabaseSnapshot()
    let isFreshDatabase = false
    if (savedDb && savedDb.length) {
      try {
        db = new sqlJs.Database(savedDb)
        info('既存DB をロード')
      } catch (err) {
        warn('既存DB ロード失敗、新規作成', err)
        db = new sqlJs.Database()
        isFreshDatabase = true
      }
    } else {
      db = new sqlJs.Database()
      isFreshDatabase = true
    }

    try {
      await ensureSchemaIntegrity(isFreshDatabase)
    } catch (schemaError) {
      warn('スキーマ整合性チェックに失敗したためクリーンなDBを再生成します', { message: schemaError?.message })
      db = new sqlJs.Database()
      isFreshDatabase = true
      await ensureSchemaIntegrity(isFreshDatabase)
    }
    
    info('データベース初期化完了')
    isInitialized = true
  } catch (err) {
    error('データベース初期化エラー', err)
    throw err
  }
}

async function ensureSchemaIntegrity(isFreshDatabase) {
  let schemaChanged = false

  // 古いスキーマを検出 (album_date に単一UNIQUE制約がある)
  const hasOldAlbumsSchema = detectOldAlbumsSchema()
  if (hasOldAlbumsSchema) {
    info('古いアルバムスキーマを検出、再構築開始')
    rebuildAlbumsTable()
    schemaChanged = true
  }

  const ensureTableSchema = () => {
    const photosCreated = ensurePhotosTable()
    const albumsCreated = ensureAlbumsTable()
    const metadataCreated = ensureMetadataTable()
    schemaChanged = schemaChanged || photosCreated || albumsCreated || metadataCreated
  }

  ensureTableSchema()

  schemaChanged = migrateLegacyPhotosIfNeeded() || schemaChanged
  schemaChanged = migrateLegacyAlbumsIfNeeded() || schemaChanged
  schemaChanged = addAlbumIdToPhotos() || schemaChanged

  schemaChanged = ensureIndexes() || schemaChanged
  schemaChanged = ensureDbVersion() || schemaChanged

  if (schemaChanged || isFreshDatabase) {
    await saveDatabase()
    info('DBスキーマ更新完了')
  }
}
/**
 * DBをローカルストレージに保存
 * @returns {Promise<void>}
 */
export async function saveDatabase() {
  try {
    ensureDatabaseInitialized()
    const data = db.export()
    await saveDatabaseSnapshot(data)
  } catch (err) {
    error('DB保存エラー', err)
    throw err
  }
}

/**
 * 写真をDBに追加
 * @param {Object} photo - {fileName: string, fileSize: number, photoDate: string, dataUri: string, albumId?: number}
 * @returns {number} 追加された写真のID
 */
export async function addPhoto(photo) {
  try {
    ensureDatabaseReady()
    const {
      fileName,
      fileSize,
      photoDate,
      dataUri,
      previewUri = dataUri ?? null,
      storageKey = null,
      mimeType = null,
      albumId = null
    } = photo

    if (!fileName || typeof fileName !== 'string') {
      throw new Error('INVALID_PHOTO_FILENAME')
    }
    if (!Number.isFinite(Number(fileSize))) {
      throw new Error('INVALID_PHOTO_FILE_SIZE')
    }
    if (!photoDate || typeof photoDate !== 'string') {
      throw new Error('INVALID_PHOTO_DATE')
    }

    db.run(
      `INSERT INTO photos (file_name, file_size, photo_date, preview_uri, storage_key, mime_type, album_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fileName, Number(fileSize), photoDate, previewUri, storageKey, mimeType, albumId ? Number(albumId) : null]
    )

    const result = db.exec('SELECT last_insert_rowid() as id')
    const id = result[0]?.values[0]?.[0]

    await saveDatabase()
    info('写真をDB追加', { id, fileName })
    return id
  } catch (err) {
    error('写真追加エラー', err)
    throw err
  }
}

/**
 * 日付別に写真を取得
 * @param {string} photoDate - YYYY-MM-DD形式
 * @returns {Array} 写真データ配列
 */
export async function getPhotosByDate(photoDate) {
  ensureDatabaseReady()

  try {
    const stmt = db.prepare(
      'SELECT id, file_name, file_size, photo_date, preview_uri, storage_key, mime_type, created_at FROM photos WHERE photo_date = ? ORDER BY created_at ASC'
    )
    stmt.bind([photoDate])
    
    const photos = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      photos.push({
        id: row.id,
        fileName: row.file_name,
        fileSize: row.file_size,
        photoDate: row.photo_date,
        previewUri: row.preview_uri,
        storageKey: row.storage_key,
        mimeType: row.mime_type,
        createdAt: row.created_at
      })
    }
    stmt.free()
    
    return photos
  } catch (err) {
    error('写真取得エラー', err)
    throw err
  }
}

/**
 * アルバムIDで写真を取得
 * @param {number} albumId - アルバムID
 * @returns {Array} 写真データ配列
 */
export async function getPhotosByAlbumId(albumId) {
  ensureDatabaseReady()

  try {
    const stmt = db.prepare(
      'SELECT id, file_name, file_size, photo_date, preview_uri, storage_key, mime_type, created_at FROM photos WHERE album_id = ? ORDER BY created_at ASC'
    )
    stmt.bind([albumId])
    
    const photos = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      photos.push({
        id: row.id,
        fileName: row.file_name,
        fileSize: row.file_size,
        photoDate: row.photo_date,
        previewUri: row.preview_uri,
        storageKey: row.storage_key,
        mimeType: row.mime_type,
        createdAt: row.created_at
      })
    }
    stmt.free()
    
    return photos
  } catch (err) {
    error('写真取得エラー', err)
    throw err
  }
}
export async function getAllAlbumDates() {
  try {
    if (!isInitialized) {
      warn('アルバム取得前にDBが初期化されていません')
      return []
    }

    ensureDatabaseReady()

    const hasLegacyDateColumn = tableHasColumn('albums', 'date')
    const hasThumbnailColumn = tableHasColumn('albums', 'thumbnail_uri')
    const hasTitleColumn = tableHasColumn('albums', 'album_title')
    const selectColumns = ['album_date', 'display_order', 'created_at']
    if (hasLegacyDateColumn) {
      selectColumns.push('date')
    }
    if (hasThumbnailColumn) {
      selectColumns.push('thumbnail_uri')
    }
    if (hasTitleColumn) {
      selectColumns.push('album_title')
    }

    const stmt = db.prepare(
      `SELECT id, ${selectColumns.join(', ')} FROM albums ORDER BY display_order ASC, created_at ASC`
    )
    
    const albums = []
    const seenOrders = new Set()
    let nextOrderCandidate = 0
    while (stmt.step()) {
      const row = stmt.getAsObject()
      const albumDate = typeof row.album_date === 'string' && row.album_date.trim() !== ''
        ? row.album_date
        : (hasLegacyDateColumn && typeof row.date === 'string' && row.date.trim() !== ''
          ? row.date
          : null)
      const createdAt = typeof row.created_at === 'string' ? row.created_at : null
      const normalizedDate = albumDate ?? (createdAt ? createdAt.slice(0, 10) : null)
      const finalDate = isValidIsoDate(normalizedDate) ? normalizedDate : '1970-01-01'

      const orderValue = Number(row.display_order)
      let finalOrder
      if (Number.isFinite(orderValue) && !seenOrders.has(orderValue)) {
        finalOrder = orderValue
      } else {
        while (seenOrders.has(nextOrderCandidate)) {
          nextOrderCandidate += 1
        }
        finalOrder = nextOrderCandidate
        nextOrderCandidate += 1
      }
      seenOrders.add(finalOrder)

      const thumbnailCandidate = hasThumbnailColumn && typeof row.thumbnail_uri === 'string'
        ? row.thumbnail_uri
        : null

      const titleCandidate = hasTitleColumn && typeof row.album_title === 'string'
        ? row.album_title.trim()
        : ''
      const albumTitle = titleCandidate.length > 0 ? titleCandidate : ''

      albums.push({
        id: row.id,
        date: finalDate,
        displayOrder: finalOrder,
        thumbnailUri: thumbnailCandidate && thumbnailCandidate.trim() !== '' ? thumbnailCandidate : null,
        title: albumTitle
      })
    }
    stmt.free()
    
    return albums
  } catch (err) {
    error('アルバム日付取得エラー', err)
    return []
  }
}

/**
 * アルバムを作成または更新
 * @param {Object} album - {albumDate: string, displayOrder: number}
 * @returns {Promise<void>}
 */
export async function createOrUpdateAlbum(album) {
  try {
    ensureDatabaseReady()
    const { albumDate, displayOrder } = album
    const hasTitleField = Object.prototype.hasOwnProperty.call(album, 'albumTitle')
    const hasThumbnailField = Object.prototype.hasOwnProperty.call(album, 'thumbnailUri')

    const normalizedTitle = hasTitleField && typeof album.albumTitle === 'string'
      ? album.albumTitle.trim()
      : ''
    
    if (!normalizedTitle) {
      throw new Error('INVALID_ALBUM_TITLE')
    }

    const normalizedThumbnail = hasThumbnailField && typeof album.thumbnailUri === 'string'
      ? album.thumbnailUri
      : (hasThumbnailField ? null : undefined)

    // 複合キー(album_date, album_title)で既存アルバムを検索
    const existingStmt = db.prepare(
      'SELECT id FROM albums WHERE album_date = ? AND album_title = ? LIMIT 1'
    )
    existingStmt.bind([albumDate, normalizedTitle])
    const exists = existingStmt.step()
    existingStmt.free()

    if (exists) {
      // 既存アルバムを更新
      db.run(
        `UPDATE albums 
         SET display_order = ?, thumbnail_uri = ? 
         WHERE album_date = ? AND album_title = ?`,
        [displayOrder, normalizedThumbnail === undefined ? null : normalizedThumbnail, albumDate, normalizedTitle]
      )
      info('アルバム更新', { albumDate, albumTitle: normalizedTitle, displayOrder })
    } else {
      // 新規アルバムを作成
      db.run(
        `INSERT INTO albums (album_date, display_order, album_title, thumbnail_uri)
         VALUES (?, ?, ?, ?)`,
        [albumDate, displayOrder, normalizedTitle, normalizedThumbnail === undefined ? null : normalizedThumbnail]
      )
      info('アルバム作成', { albumDate, albumTitle: normalizedTitle, displayOrder })
    }

    // レガシースキーマの互換性維持: date カラムが存在する場合のみ更新
    if (tableHasColumn('albums', 'date')) {
      db.run(
        'UPDATE albums SET date = ? WHERE album_date = ?',
        [albumDate, albumDate]
      )
    }
    await saveDatabase()
  } catch (err) {
    error('アルバム作成エラー', err)
    throw err
  }
}

/**
 * 日付別の写真数を取得
 * @returns {Object} {日付: 写真数}
 */
export async function getPhotoCounts() {
  try {
    ensureDatabaseReady()
    const stmt = db.prepare(
      'SELECT photo_date, COUNT(*) as count FROM photos GROUP BY photo_date ORDER BY photo_date DESC'
    )
    
    const counts = {}
    while (stmt.step()) {
      const row = stmt.getAsObject()
      counts[row.photo_date] = row.count
    }
    stmt.free()
    
    return counts
  } catch (err) {
    error('写真数取得エラー', err)
    return {}
  }
}

/**
 * アルバム順序を更新
 * @param {Array} albumDates - 新しい順序の日付配列
 * @returns {Promise<void>}
 */
export async function updateAlbumOrder(albumDates) {
  try {
    ensureDatabaseReady()
    
    // albumDate -> displayOrder のマッピングから、album_date と album_title で各アルバムのdisplayOrderを更新
    for (let i = 0; i < albumDates.length; i++) {
      const albumDate = albumDates[i]
      
      // 指定された日付のすべてのアルバムを取得
      const stmt = db.prepare(
        'SELECT id, album_title FROM albums WHERE album_date = ? ORDER BY display_order ASC'
      )
      stmt.bind([albumDate])
      
      const albums = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        albums.push({
          id: row.id,
          albumTitle: row.album_title || ''
        })
      }
      stmt.free()
      
      // 最初のアルバムのdisplayOrderを更新
      if (albums.length > 0) {
        db.run(
          'UPDATE albums SET display_order = ? WHERE id = ?',
          [i, albums[0].id]
        )
      }
    }
    
    await saveDatabase()
    info('アルバム順序更新完了', { count: albumDates.length })
  } catch (err) {
    error('アルバム順序更新エラー', err)
    throw err
  }
}

/**
 * アルバムサムネイルを更新
 * @param {string} albumDate
 * @param {string|null} thumbnailUri
 * @returns {Promise<void>}
 */
export async function updateAlbumThumbnail(albumId, thumbnailUri) {
  try {
    ensureDatabaseReady()
    if (!Number.isInteger(albumId)) {
      throw new Error('INVALID_ALBUM_ID')
    }
    db.run('UPDATE albums SET thumbnail_uri = ? WHERE id = ?', [thumbnailUri, albumId])
    await saveDatabase()
    info('アルバムサムネイル更新', { albumId })
  } catch (err) {
    error('アルバムサムネイル更新エラー', err)
    throw err
  }
}

/**
 * アルバムタイトルを更新
 * @param {string} albumDate
 * @param {string} albumTitle
 * @returns {Promise<void>}
 */
export async function updateAlbumTitle(albumId, albumTitle) {
  try {
    ensureDatabaseReady()
    const normalizedTitle = typeof albumTitle === 'string' ? albumTitle.trim() : ''
    if (normalizedTitle.length === 0) {
      throw new Error('INVALID_ALBUM_TITLE')
    }
    db.run('UPDATE albums SET album_title = ? WHERE id = ?', [normalizedTitle, albumId])
    await saveDatabase()
    info('アルバムタイトル更新', { albumId })
  } catch (err) {
    error('アルバムタイトル更新エラー', err)
    throw err
  }
}

/**
 * 指定日付の写真をすべて削除
 * @param {string} photoDate - YYYY-MM-DD形式
 * @returns {Promise<void>}
 */
export async function deletePhotosByDate(photoDate) {
  try {
    ensureDatabaseReady()
    db.run('DELETE FROM photos WHERE photo_date = ?', [photoDate])
    db.run('DELETE FROM albums WHERE album_date = ?', [photoDate])
    await saveDatabase()
    info('写真を削除', { photoDate })
  } catch (err) {
    error('写真削除エラー', err)
    throw err
  }
}

/**
 * 指定IDの写真を削除
 * @param {number} photoId
 * @returns {Promise<void>}
 */
export async function deletePhotoById(photoId) {
  try {
    ensureDatabaseReady()
    db.run('DELETE FROM photos WHERE id = ?', [photoId])
    await saveDatabase()
    info('写真を削除', { photoId })
  } catch (err) {
    error('写真削除エラー', err)
    throw err
  }
}

/**
 * 指定IDのアルバムを削除（同じ日付の他のアルバムは削除しない）
 * @param {number} albumId
 * @returns {Promise<void>}
 */
export async function deleteAlbumById(albumId) {
  try {
    ensureDatabaseReady()
    db.run('DELETE FROM albums WHERE id = ?', [albumId])
    await saveDatabase()
    info('アルバムを削除', { albumId })
  } catch (err) {
    error('アルバム削除エラー', err)
    throw err
  }
}

export async function getPhotosPendingStorageMigration(limit = 100) {
  ensureDatabaseReady()

  const needsMigration = []
  const safeLimit = Math.max(1, Number(limit) || 25)
  const stmt = db.prepare(`
    SELECT id, file_name, file_size, photo_date, preview_uri, storage_key, mime_type
    FROM photos
    WHERE (storage_key IS NULL OR TRIM(storage_key) = '')
       OR (mime_type IS NULL OR TRIM(mime_type) = '')
       OR (preview_uri IS NULL OR TRIM(preview_uri) = '')
    LIMIT ${safeLimit}
  `)

  while (stmt.step()) {
    const row = stmt.getAsObject()
    needsMigration.push({
      id: row.id,
      fileName: row.file_name,
      fileSize: row.file_size,
      photoDate: row.photo_date,
      previewUri: row.preview_uri,
      storageKey: row.storage_key,
      mimeType: row.mime_type
    })
  }
  stmt.free()

  return needsMigration
}

export function updatePhotoStorageMetadata(photoId, { previewUri, storageKey, mimeType }) {
  try {
    ensureDatabaseReady()

    const fields = []
    const values = []

    if (typeof previewUri !== 'undefined') {
      fields.push('preview_uri = ?')
      values.push(previewUri)
    }
    if (typeof storageKey !== 'undefined') {
      fields.push('storage_key = ?')
      values.push(storageKey)
    }
    if (typeof mimeType !== 'undefined') {
      fields.push('mime_type = ?')
      values.push(mimeType)
    }

    if (fields.length === 0) {
      return
    }

    values.push(photoId)
    db.run(`UPDATE photos SET ${fields.join(', ')} WHERE id = ?`, values)
  } catch (err) {
    error('写真ストレージメタデータ更新エラー', err)
    throw err
  }
}

/**
 * すべてのデータをクリア
 * @returns {Promise<void>}
 */
export async function clearDatabase() {
  try {
    ensureDatabaseReady()
    db.run('DELETE FROM photos')
    db.run('DELETE FROM albums')
    if (tableExists('metadata')) {
      db.run('DELETE FROM metadata WHERE key = ?', ['db_version'])
    }
    await saveDatabase()
    info('データベースをクリア')
  } catch (err) {
    error('データベースクリアエラー', err)
    throw err
  }
}

export default {
  initDatabase,
  saveDatabase,
  addPhoto,
  getPhotosByDate,
  getPhotosByAlbumId,
  getAllAlbumDates,
  createOrUpdateAlbum,
  updateAlbumOrder,
  getPhotoCounts,
  deletePhotosByDate,
  deletePhotoById,
  deleteAlbumById,
  updateAlbumThumbnail,
  updateAlbumTitle,
  clearDatabase,
  getPhotosPendingStorageMigration,
  updatePhotoStorageMetadata
}

function ensurePhotosTable() {
  if (tableExists('photos')) {
    return false
  }

  db.run(`
    CREATE TABLE photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      photo_date TEXT NOT NULL,
      preview_uri TEXT,
      storage_key TEXT,
      mime_type TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `)
  return true
}

function ensureAlbumsTable() {
  if (tableExists('albums')) {
    return false
  }

  db.run(`
    CREATE TABLE albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_date TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      album_title TEXT NOT NULL DEFAULT '',
      thumbnail_uri TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(album_date, album_title)
    );
  `)
  return true
}

/**
 * 古いアルバムスキーマを検出（album_date に単一UNIQUE制約）
 */
function detectOldAlbumsSchema() {
  try {
    if (!tableExists('albums')) {
      return false
    }
    
    const result = db.exec(`PRAGMA table_info(albums)`)
    if (result.length === 0) {
      return false
    }
    
    // テーブル構造をチェック
    const columns = result[0].values
    const albumDateCol = columns.find(col => col[1] === 'album_date')
    
    // album_dateカラムが存在し、さらにインデックスをチェック
    const indexResult = db.exec(`SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='albums' AND sql LIKE '%album_date%'`)
    
    // 複合キー UNIQUE(album_date, album_title) があるかチェック
    const createTableResult = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='albums'`)
    if (createTableResult.length > 0) {
      const createSql = createTableResult[0].values[0][0]
      if (createSql && createSql.includes('UNIQUE(album_date, album_title)')) {
        return false // 新スキーマ
      }
      if (createSql && createSql.includes('album_date') && !createSql.includes('UNIQUE(album_date, album_title)')) {
        return true // 古いスキーマ
      }
    }
    
    return false
  } catch (err) {
    warn('古いスキーマ検出エラー', err)
    return false
  }
}

/**
 * 古いアルバムテーブルを新スキーマに再構築
 */
function rebuildAlbumsTable() {
  try {
    if (!tableExists('albums')) {
      return
    }

    db.run('DROP TABLE IF EXISTS albums__new')
    db.run(`
      CREATE TABLE albums__new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        album_date TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        album_title TEXT NOT NULL DEFAULT '',
        thumbnail_uri TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(album_date, album_title)
      );
    `)

    const selectStmt = db.prepare('SELECT * FROM albums')
    const insertStmt = db.prepare('INSERT INTO albums__new (id, album_date, display_order, album_title, thumbnail_uri, created_at) VALUES (?, ?, ?, ?, ?, ?)')

    const seenPairs = new Set()
    let counter = 0

    while (selectStmt.step()) {
      const row = selectStmt.getAsObject()
      const id = Number(row.id)
      const albumDate = row.album_date || new Date().toISOString().slice(0, 10)
      const displayOrder = Number(row.display_order) || counter
      const createdAt = row.created_at || new Date().toISOString()
      const thumbnailUri = row.thumbnail_uri || null

      let albumTitle = row.album_title || albumDate

      // 複合キー(date, title)の重複をチェック
      const pairKey = `${albumDate}|${albumTitle}`
      if (seenPairs.has(pairKey)) {
        let dupCounter = 1
        let newTitle = `${albumTitle} (${dupCounter})`
        let newPairKey = `${albumDate}|${newTitle}`
        while (seenPairs.has(newPairKey)) {
          dupCounter++
          newTitle = `${albumTitle} (${dupCounter})`
          newPairKey = `${albumDate}|${newTitle}`
        }
        albumTitle = newTitle
      }
      seenPairs.add(`${albumDate}|${albumTitle}`)

      insertStmt.run([
        Number.isFinite(id) ? id : null,
        albumDate,
        displayOrder,
        albumTitle,
        thumbnailUri,
        createdAt
      ])
      counter++
    }

    selectStmt.free()
    insertStmt.free()

    db.run('DROP TABLE albums')
    db.run('ALTER TABLE albums__new RENAME TO albums')

    info('古いアルバムテーブルを再構築', { count: counter })
  } catch (err) {
    error('アルバムテーブル再構築エラー', err)
    db.run('DROP TABLE IF EXISTS albums__new')
    throw err
  }
}

function ensureMetadataTable() {
  if (tableExists('metadata')) {
    return false
  }

  db.run(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  return true
}

function migrateLegacyPhotosIfNeeded() {
  if (!tableExists('photos')) {
    return false
  }

  const columns = getTableColumns('photos')
  const requiredColumns = ['id', 'file_name', 'file_size', 'photo_date', 'preview_uri', 'storage_key', 'mime_type', 'created_at']
  const missing = requiredColumns.filter(column => !columns.includes(column))

  if (missing.length === 0) {
    return false
  }

  try {
    const albumDateById = new Map()
    if (tableExists('albums')) {
      try {
        // レガシースキーマでは album_date, created_at カラムが存在しない可能性がある
        const albumColumns = getTableColumns('albums')
        const hasAlbumDate = albumColumns.includes('album_date')
        const hasDate = albumColumns.includes('date')
        const hasCreatedAt = albumColumns.includes('created_at')
        
        const selectCols = ['id']
        if (hasAlbumDate) selectCols.push('album_date')
        if (hasDate) selectCols.push('date')
        if (hasCreatedAt) selectCols.push('created_at')
        
        const albumStmt = db.prepare(`SELECT ${selectCols.join(', ')} FROM albums`)
        while (albumStmt.step()) {
          const row = albumStmt.getAsObject()
          const albumId = Number(row.id)
          if (!Number.isFinite(albumId)) {
            continue
          }

          const candidates = [row.album_date, row.date]
            .map(value => (typeof value === 'string' ? value.trim().slice(0, 10) : null))
            .filter(candidate => isValidIsoDate(candidate))

          let selectedDate = candidates[0]
          if (!selectedDate && hasCreatedAt && typeof row.created_at === 'string') {
            const createdCandidate = row.created_at.slice(0, 10)
            if (isValidIsoDate(createdCandidate)) {
              selectedDate = createdCandidate
            }
          }

          if (selectedDate) {
            albumDateById.set(albumId, selectedDate)
          }
        }
        albumStmt.free()
      } catch (legacyErr) {
        warn('レガシーアルバム情報取得エラー', legacyErr)
      }
    }

    db.run('DROP TABLE IF EXISTS photos__new')
    db.run(`
      CREATE TABLE photos__new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        photo_date TEXT NOT NULL,
        preview_uri TEXT,
        storage_key TEXT,
        mime_type TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    const selectStmt = db.prepare('SELECT * FROM photos')
    const insertStmt = db.prepare('INSERT INTO photos__new (id, file_name, file_size, photo_date, preview_uri, storage_key, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')

    const fallbackDate = new Date().toISOString().slice(0, 10)
    let migratedCount = 0

    while (selectStmt.step()) {
      const row = selectStmt.getAsObject()
      const id = Number(row.id)
      const fileName = row.file_name || `photo_${id || migratedCount + 1}`
      const fileSize = Number(row.file_size) || 0
      const originalDataUri = typeof row.data_uri === 'string' && row.data_uri.trim() !== ''
        ? row.data_uri
        : null
      const previewUri = typeof row.preview_uri === 'string' && row.preview_uri.trim() !== ''
        ? row.preview_uri
        : originalDataUri
      const storageKey = typeof row.storage_key === 'string' && row.storage_key.trim() !== ''
        ? row.storage_key.trim()
        : null
      let mimeType = typeof row.mime_type === 'string' && row.mime_type.trim() !== ''
        ? row.mime_type.trim()
        : null
      if (!mimeType && typeof originalDataUri === 'string') {
        const match = originalDataUri.match(/^data:([^;]+);/)
        if (match && match[1]) {
          mimeType = match[1]
        }
      }

      let createdAt = typeof row.created_at === 'string' && row.created_at.trim() !== ''
        ? row.created_at
        : new Date().toISOString()

      let photoDate = null
      const photoDateCandidate = typeof row.photo_date === 'string' ? row.photo_date.trim() : ''
      if (isValidIsoDate(photoDateCandidate)) {
        photoDate = photoDateCandidate
      }

      const legacyDateCandidates = [row.date, row.album_date, row.albumDate]
        .map(value => (typeof value === 'string' ? value.trim().slice(0, 10) : null))
        .filter(candidate => isValidIsoDate(candidate))

      if (!photoDate && legacyDateCandidates.length > 0) {
        photoDate = legacyDateCandidates[0]
      }

      if (!photoDate) {
        const albumId = Number(row.album_id ?? row.albumId)
        if (Number.isFinite(albumId) && albumDateById.has(albumId)) {
          photoDate = albumDateById.get(albumId)
        }
      }

      if (!photoDate && typeof createdAt === 'string') {
        const createdDate = createdAt.slice(0, 10)
        if (isValidIsoDate(createdDate)) {
          photoDate = createdDate
        }
      }

      if (!photoDate) {
        photoDate = fallbackDate
      }

      insertStmt.run([
        Number.isFinite(id) ? id : null,
        fileName,
        fileSize,
        photoDate,
        previewUri,
        storageKey,
        mimeType,
        createdAt
      ])
      migratedCount += 1
    }

    selectStmt.free()
    insertStmt.free()

    db.run('DROP TABLE photos')
    db.run('ALTER TABLE photos__new RENAME TO photos')

    info('photos テーブルを移行', { migratedCount, missing })
    return true
  } catch (err) {
    error('photos テーブル移行エラー', err)
    db.run('DROP TABLE IF EXISTS photos__new')
    throw err
  }
}

function migrateLegacyAlbumsIfNeeded() {
  if (!tableExists('albums')) {
    return false
  }

  const columns = getTableColumns('albums')
  const requiredColumns = ['id', 'album_date', 'display_order', 'created_at', 'thumbnail_uri', 'album_title']
  const missing = requiredColumns.filter(column => !columns.includes(column))

  if (missing.length === 0) {
    return false
  }

  try {
    db.run('DROP TABLE IF EXISTS albums__new')
    db.run(`
      CREATE TABLE albums__new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        album_date TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        album_title TEXT NOT NULL DEFAULT '',
        thumbnail_uri TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(album_date, album_title)
      );
    `)

    const selectStmt = db.prepare('SELECT * FROM albums')
    const insertStmt = db.prepare('INSERT INTO albums__new (id, album_date, display_order, album_title, thumbnail_uri, created_at) VALUES (?, ?, ?, ?, ?, ?)')

    const seenPairs = new Set()
    const seenOrders = new Set()
    let fallbackOrder = 0
    let migratedCount = 0

    while (selectStmt.step()) {
      const row = selectStmt.getAsObject()
      const id = Number(row.id)
      const createdAt = typeof row.created_at === 'string' && row.created_at.trim() !== ''
        ? row.created_at
        : new Date().toISOString()

      const rawDate = [row.album_date, row.date, row.albumDate]
        .find(value => typeof value === 'string' && value.trim() !== '')
      const normalizedDate = rawDate ? rawDate.trim().slice(0, 10) : null
      const albumDate = isValidIsoDate(normalizedDate) ? normalizedDate : createdAt.slice(0, 10)

      const parsedOrder = Number(row.display_order)
      let displayOrder = Number.isFinite(parsedOrder) ? parsedOrder : null

      const existingThumbnail = typeof row.thumbnail_uri === 'string' && row.thumbnail_uri.trim() !== ''
        ? row.thumbnail_uri.trim()
        : null

      const legacyTitleCandidates = [row.album_title, row.title, row.name]
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .filter(value => value.length > 0)

      let albumTitle = legacyTitleCandidates.length > 0 ? legacyTitleCandidates[0] : albumDate
      
      // 複合キー(date, title)の重複をチェック - 重複した場合はタイトルを変更
      const pairKey = `${albumDate}|${albumTitle}`
      if (seenPairs.has(pairKey)) {
        // 番号を追加して一意にする
        let counter = 1
        let newTitle = `${albumTitle} (${counter})`
        let newPairKey = `${albumDate}|${newTitle}`
        while (seenPairs.has(newPairKey)) {
          counter++
          newTitle = `${albumTitle} (${counter})`
          newPairKey = `${albumDate}|${newTitle}`
        }
        albumTitle = newTitle
      }
      seenPairs.add(`${albumDate}|${albumTitle}`)

      if (displayOrder === null || seenOrders.has(displayOrder)) {
        while (seenOrders.has(fallbackOrder)) {
          fallbackOrder += 1
        }
        displayOrder = fallbackOrder
      }

      seenOrders.add(displayOrder)

      insertStmt.run([
        Number.isFinite(id) ? id : null,
        albumDate,
        displayOrder,
        albumTitle,
        existingThumbnail,
        createdAt
      ])
      migratedCount += 1
    }

    selectStmt.free()
    insertStmt.free()

    db.run('DROP TABLE albums')
    db.run('ALTER TABLE albums__new RENAME TO albums')

    info('albums テーブルを移行', { migratedCount, missing })
    return true
  } catch (err) {
    error('albums テーブル移行エラー', err)
    db.run('DROP TABLE IF EXISTS albums__new')
    throw err
  }
}

/**
 * photos テーブルに album_id カラムを追加（スキーマバージョン9へのアップグレード）
 */
function addAlbumIdToPhotos() {
  if (!tableExists('photos')) {
    return false
  }

  const columns = getTableColumns('photos')
  if (columns.includes('album_id')) {
    return false // already migrated
  }

  try {
    db.run('ALTER TABLE photos ADD COLUMN album_id INTEGER')
    info('photos テーブルに album_id カラムを追加')
    return true
  } catch (err) {
    warn('photos テーブルへの album_id 追加エラー', err)
    return false
  }
}

function ensureIndexes() {
  let changed = false

  if (!indexExists('idx_photos_date')) {
    db.run('CREATE INDEX idx_photos_date ON photos(photo_date)')
    changed = true
  }

  if (!indexExists('idx_photos_storage_key')) {
    db.run('CREATE INDEX idx_photos_storage_key ON photos(storage_key)')
    changed = true
  }

  if (!indexExists('idx_albums_order')) {
    db.run('CREATE INDEX idx_albums_order ON albums(display_order)')
    changed = true
  }

  // インデックスは composite key をサポートするために削除
  if (indexExists('idx_albums_unique_date')) {
    db.run('DROP INDEX IF EXISTS idx_albums_unique_date')
    changed = true
  }

  return changed
}

function ensureDbVersion() {
  try {
    const stmt = db.prepare('SELECT value FROM metadata WHERE key = ? LIMIT 1')
    stmt.bind(['db_version'])

    let currentVersion = null
    if (stmt.step()) {
      const row = stmt.get()
      currentVersion = row?.[0] || null
    }
    stmt.free()

    const currentVersionNum = currentVersion ? parseInt(currentVersion, 10) : 0
    const targetVersionNum = DB_VERSION

    if (currentVersionNum === targetVersionNum) {
      return false
    }

    // バージョンアップの場合、古いアルバムテーブルをマイグレーション
    if (currentVersionNum < targetVersionNum && tableExists('albums')) {
      info('DB version migration', { from: currentVersionNum, to: targetVersionNum })
      migrateLegacyAlbumsIfNeeded()
    }

    const upsert = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)')
    upsert.run(['db_version', String(DB_VERSION)])
    upsert.free()

    return true
  } catch (err) {
    warn('DBバージョン更新エラー', err)
    return false
  }
}

function isValidIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function tableExists(tableName) {
  try {
    const result = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}' LIMIT 1`)
    return result.length > 0
  } catch (err) {
    warn('テーブル存在確認エラー', { tableName, message: err?.message })
    return false
  }
}

function tableHasColumn(tableName, columnName) {
  try {
    const columns = getTableColumns(tableName)
    return columns.includes(columnName)
  } catch (err) {
    warn('カラム存在確認エラー', { tableName, columnName, message: err?.message })
    return false
  }
}

function getTableColumns(tableName) {
  try {
    const result = db.exec(`PRAGMA table_info(${tableName})`)
    if (result.length === 0) {
      return []
    }
    return result[0].values.map(row => row[1])
  } catch (err) {
    warn('テーブル情報取得エラー', { tableName, message: err?.message })
    return []
  }
}

function indexExists(indexName) {
  try {
    const result = db.exec(`SELECT name FROM sqlite_master WHERE type='index' AND name='${indexName}' LIMIT 1`)
    return result.length > 0
  } catch (err) {
    warn('インデックス存在確認エラー', { indexName, message: err?.message })
    return false
  }
}

function resolveSqlWasmPath(file) {
  const isNodeRuntime = typeof process !== 'undefined' && process.versions?.node

  if (isNodeRuntime) {
    try {
      const url = new URL(`../../node_modules/sql.js/dist/${file}`, import.meta.url)
      let pathname = decodeURIComponent(url.pathname)

      const viteFsMarker = '/@fs/'
      const viteFsIndex = pathname.indexOf(viteFsMarker)
      if (viteFsIndex !== -1) {
        pathname = pathname.slice(viteFsIndex + viteFsMarker.length)
      }

      // Windows環境では先頭のスラッシュを削除し、バックスラッシュ区切りに変換
      if (/^\/[A-Za-z]:/.test(pathname)) {
        pathname = pathname.slice(1)
      }

      if (process.platform === 'win32') {
        pathname = pathname.replace(/\//g, '\\')
      }

      return pathname
    } catch (err) {
      warn('WASMパス解決エラー', err)
    }
  }

  return `https://sql.js.org/dist/${file}`
}
