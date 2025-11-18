/**
 * フォトアルバムオーガナイザー - メインアプリケーション
 * SEC-003: XSS対策（htmlエスケープ）
 */

import {
  initDatabase,
  addPhoto,
  deletePhotoById,
  deletePhotosByDate,
  getPhotosByDate,
  clearDatabase,
  getPhotosPendingStorageMigration,
  updatePhotoStorageMetadata,
  saveDatabase
} from './services/DatabaseService.js'
import { getAllAlbums, initializeAlbumsWithPhotos, updateAlbumOrder, createManualAlbum, setAlbumThumbnail, updateAlbumTitle } from './services/AlbumService.js'
import {
  initializeStorage,
  storeOriginalPhoto,
  getOriginalPhotoBlob,
  deleteStoredPhoto,
  clearAllPhotos
} from './services/StorageService.js'
import { extractPhotoDate, formatDate, formatDateJapanese } from './utils/dateUtils.js'
import { validateFileList } from './utils/fileValidation.js'
import { setLogLevel, info, error, warn } from './utils/logger.js'

/**
 * HTMLエスケープ関数（XSS対策）
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// UI要素キャッシュ
const ui = {
  mainPage: document.getElementById('main-page'),
  albumView: document.getElementById('album-view'),
  fullsizeModal: document.getElementById('fullsize-modal'),
  createAlbumModal: document.getElementById('create-album-modal'),
  loading: document.getElementById('loading'),
  
  addPhotosBtn: document.getElementById('add-photos-btn'),
  albumAddPhotosBtn: document.getElementById('album-add-photos-btn'),
  albumRenameBtn: document.getElementById('album-rename-btn'),
  fileInput: document.getElementById('file-input'),
  createAlbumBtn: document.getElementById('create-album-btn'),
  clearDataBtn: document.getElementById('clear-data-btn'),
  albumsContainer: document.getElementById('albums-container'),
  
  // ソートコントロール
  sortSelect: document.getElementById('sort-select'),
  sortOrderBtn: document.getElementById('sort-order-btn'),
  
  backBtn: document.getElementById('back-btn'),
  albumTitle: document.getElementById('album-title'),
  albumMeta: document.getElementById('album-meta'),
  tileGrid: document.getElementById('tile-grid'),
  
  // アルバム作成モーダル
  albumTitleInput: document.getElementById('album-title-input'),
  albumDateInput: document.getElementById('album-date-input'),
  albumCreateBtn: document.getElementById('album-create-btn'),
  albumClearBtn: document.getElementById('album-clear-btn'),
  albumCancelBtn: document.getElementById('album-cancel-btn'),
  
  fullsizeImage: document.getElementById('fullsize-image'),
  downloadBtn: document.getElementById('download-btn'),
  modalCloseBtn: document.getElementById('modal-close-btn')
}

// アプリケーション状態
const state = {
  albums: [],
  currentAlbumDate: null,
  currentAlbumId: null,
  currentAlbumTitle: '',
  draggedAlbumElement: null,
  draggedAlbumIndex: null,
  currentPhoto: null,
  currentPhotoBlob: null,
  currentPhotoObjectUrl: null,
  sortBy: 'order',
  sortOrder: 'asc'
}

const PREVIEW_MAX_EDGE = 480
const PREVIEW_JPEG_QUALITY = 0.82

/**
 * アプリケーション初期化
 */
async function initialize() {
  try {
    setLogLevel('INFO')
    
    info('アプリケーション初期化開始')
    
    // DBを初期化
    await initDatabase()
    info('データベース初期化完了')

    // ストレージを初期化（IndexedDB）
    await initializeStorage()
    info('バイナリストレージ初期化完了')

    // レガシーデータ移行
    await migrateLegacyPhotoStorageIfNeeded()

    // UIイベント設定
    setupEventListeners()

    // 既存アルバムをロード
    await loadAlbums()
    
    // メインページを表示
    showMainPage()
    
    info('アプリケーション初期化完了')
  } catch (err) {
    error('初期化エラー', err)
    ui.mainPage.innerHTML = `
      <div style="padding: 2rem; text-align: center;">
        <h2>エラーが発生しました</h2>
        <p style="color: red; margin: 1rem 0;">${err.message}</p>
        <p style="font-size: 0.9rem; color: #666;">
          コンソールで詳細なエラー情報を確認してください。<br>
          ページを再読み込みしてください。
        </p>
      </div>
    `
    ui.mainPage.classList.remove('hidden')
  }
}

/**
 * UIイベントリスナーを設定
 */
function setupEventListeners() {
  ;[ui.addPhotosBtn, ui.albumAddPhotosBtn]
    .filter(Boolean)
    .forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault()
        if (ui.fileInput) {
          ui.fileInput.click()
        }
      })
    })

  ui.fileInput.addEventListener('change', handleFileUpload)

  if (ui.createAlbumBtn) {
    ui.createAlbumBtn.addEventListener('click', handleCreateAlbumClick)
  }

  if (ui.clearDataBtn) {
    ui.clearDataBtn.addEventListener('click', (event) => {
      event.preventDefault()
      clearAllData()
    })
  }

  // アルバム作成モーダルイベント
  if (ui.albumCreateBtn) {
    ui.albumCreateBtn.addEventListener('click', createAlbumFromModal)
  }

  if (ui.albumClearBtn) {
    ui.albumClearBtn.addEventListener('click', () => {
      if (ui.albumTitleInput) {
        ui.albumTitleInput.value = ''
      }
      if (ui.albumDateInput) {
        ui.albumDateInput.value = ''
        ui.albumDateInput.focus()
      }
    })
  }

  if (ui.albumCancelBtn) {
    ui.albumCancelBtn.addEventListener('click', hideCreateAlbumModal)
  }

  if (ui.createAlbumModal) {
    ui.createAlbumModal.addEventListener('click', (event) => {
      if (event.target === ui.createAlbumModal) {
        hideCreateAlbumModal()
      }
    })
  }

  if (ui.albumRenameBtn) {
    ui.albumRenameBtn.addEventListener('click', async (event) => {
      event.preventDefault()
      await handleRenameAlbum(state.currentAlbumDate)
    })
  }
  
  // ソートコントロール
  if (ui.sortSelect) {
    ui.sortSelect.addEventListener('change', (event) => {
      state.sortBy = event.target.value
      loadAlbums()
    })
  }
  
  if (ui.sortOrderBtn) {
    ui.sortOrderBtn.addEventListener('click', (event) => {
      event.preventDefault()
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
      if (ui.sortOrderBtn.classList.contains('desc')) {
        ui.sortOrderBtn.classList.remove('desc')
      } else {
        ui.sortOrderBtn.classList.add('desc')
      }
      loadAlbums()
    })
  }
  
  ui.backBtn.addEventListener('click', showMainPage)
  
  ui.modalCloseBtn.addEventListener('click', hideFullsizeModal)
  ui.downloadBtn.addEventListener('click', downloadCurrentPhoto)
  
  // ドラッグ&ドロップ
  document.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  })
  
  document.addEventListener('drop', handleFileDrop)
}

/**
 * ファイル選択ダイアログでのアップロード処理
 */
async function handleFileUpload(event) {
  const files = event.target.files
  await processFiles(files)
  event.target.value = ''
}

/**
 * ドラッグ&ドロップでのアップロード処理
 */
async function handleFileDrop(event) {
  event.preventDefault()
  
  // ドラッグ&ドロップでの写真追加は無効化
  warn('ドラッグ&ドロップでの写真追加は無効です。「写真を追加」ボタンを使用してください。')
  return
}

/**
 * ファイル処理
 */
async function processFiles(files, options = {}) {
  try {
    showLoading(true)
    
    const { valid, invalid } = validateFileList(files)
    
    if (invalid.length > 0) {
      warn(`${invalid.length}個のファイルが無効です`, invalid.map(x => x.error))
    }
    
    if (valid.length === 0) {
      alert('処理対象の有効な画像がありません')
      return
    }
    
    const newPhotos = []
    
    const targetAlbumFromOption = typeof options.albumDate === 'string' && options.albumDate.trim().length > 0
      ? options.albumDate.trim()
      : null
    let lastUsedAlbumDate = targetAlbumFromOption || state.currentAlbumDate || null

    for (const file of valid) {
      try {
        const extractedDate = await extractPhotoDate(file)
        const derivedDate = formatDate(extractedDate)
        let preferredAlbumDate = lastUsedAlbumDate

        if (preferredAlbumDate) {
          try {
            preferredAlbumDate = formatDate(preferredAlbumDate)
          } catch (dateErr) {
            warn('指定されたアルバム日付の正規化に失敗したため、写真日付を使用します', dateErr)
            preferredAlbumDate = null
          }
        }

        const dateStr = preferredAlbumDate || derivedDate

        const preview = await createPreviewFromFile(file)
        const storageKey = generateStorageKey()
        const mimeType = determineMimeType(file, preview)

        let photoId = null
        try {
          photoId = await addPhoto({
            fileName: file.name,
            fileSize: file.size,
            photoDate: dateStr,
            previewUri: preview.dataUrl,
            storageKey,
            mimeType,
            albumId: state.currentAlbumId || null
          })

          await storeOriginalPhoto(storageKey, file)

          newPhotos.push({
            id: photoId,
            fileName: file.name,
            fileSize: file.size,
            photoDate: dateStr,
            previewUri: preview.dataUrl,
            storageKey,
            mimeType
          })

          lastUsedAlbumDate = dateStr
        } catch (storageError) {
          if (photoId !== null) {
            try {
              await deletePhotoById(photoId)
            } catch (cleanupErr) {
              warn('写真登録ロールバックに失敗しました', cleanupErr)
            }
          }
          throw storageError
        }
      } catch (err) {
        error(`ファイル処理エラー: ${file.name}`, err)
        alert(`「${file.name}」の処理に失敗しました: ${err.message}`)
      }
    }
    
    // アルバムを初期化
    if (newPhotos.length > 0) {
      await initializeAlbumsWithPhotos(newPhotos)
      await loadAlbums()
      // state.currentAlbumId で正確なアルバムを表示（albumId ベース）
      if (state.currentAlbumId) {
        showAlbumView(state.currentAlbumDate, state.currentAlbumId)
      } else {
        const lastAlbumDate = lastUsedAlbumDate || state.currentAlbumDate
        if (lastAlbumDate) {
          showAlbumView(lastAlbumDate)
        }
      }
      info(`${newPhotos.length}個の写真を処理`)
    }
  } catch (err) {
    error('ファイル処理エラー', err)
    alert('ファイル処理中にエラーが発生しました')
  } finally {
    showLoading(false)
  }
}

async function createPreviewFromFile(file) {
  if (!file) {
    return { dataUrl: '', mimeType: 'image/jpeg' }
  }

  try {
    return await createPreviewFromBlob(file)
  } catch (err) {
    warn('プレビュー生成に失敗したため、元データを使用します', err)
    const fallbackUri = await fileToDataUri(file)
    return { dataUrl: fallbackUri, mimeType: file.type || 'image/jpeg' }
  }
}

async function createPreviewFromBlob(blob) {
  if (!blob || typeof blob.type !== 'string' || !blob.type.startsWith('image/')) {
    const dataUrl = await fileToDataUri(blob)
    return { dataUrl, mimeType: blob?.type || 'application/octet-stream' }
  }

  const image = await loadImageFromBlob(blob)
  const { width, height } = calculatePreviewDimensions(image.naturalWidth || image.width, image.naturalHeight || image.height, PREVIEW_MAX_EDGE)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { alpha: true })
  context.drawImage(image, 0, 0, width, height)

  const outputType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const quality = outputType === 'image/jpeg' ? PREVIEW_JPEG_QUALITY : undefined
  const dataUrl = canvas.toDataURL(outputType, quality)
  return { dataUrl, width, height, mimeType: outputType }
}

function calculatePreviewDimensions(originalWidth, originalHeight, maxEdge) {
  if (!Number.isFinite(originalWidth) || !Number.isFinite(originalHeight) || originalWidth <= 0 || originalHeight <= 0) {
    return { width: 1, height: 1 }
  }

  const largestEdge = Math.max(originalWidth, originalHeight)
  if (largestEdge <= maxEdge) {
    return { width: Math.round(originalWidth), height: Math.round(originalHeight) }
  }

  const scale = maxEdge / largestEdge
  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale))
  }
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (event) => {
      URL.revokeObjectURL(url)
      reject(event)
    }
    img.src = url
  })
}

function generateStorageKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `photo-${crypto.randomUUID()}`
  }
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `photo-${Date.now()}-${randomPart}`
}

function determineMimeType(file, preview) {
  if (file && typeof file.type === 'string' && file.type) {
    return file.type
  }
  if (preview && typeof preview.mimeType === 'string') {
    return preview.mimeType
  }
  if (preview && typeof preview.dataUrl === 'string') {
    const match = preview.dataUrl.match(/^data:([^;]+);/)
    if (match && match[1]) {
      return match[1]
    }
  }
  return 'image/jpeg'
}

async function migrateLegacyPhotoStorageIfNeeded() {
  try {
    let pending = await getPhotosPendingStorageMigration(25)
    if (!pending.length) {
      return
    }

    showLoading(true)
    let migratedCount = 0

    while (pending.length) {
      for (const photo of pending) {
        if (!photo.previewUri) {
          continue
        }

        try {
          const legacyBlob = dataUriToBlob(photo.previewUri)
          const storageKey = generateStorageKey()
          const preview = await createPreviewFromBlob(legacyBlob)
          const mimeType = determineMimeType({ type: photo.mimeType }, preview)

          await storeOriginalPhoto(storageKey, legacyBlob)
          updatePhotoStorageMetadata(photo.id, {
            previewUri: preview.dataUrl,
            storageKey,
            mimeType
          })
          migratedCount += 1
        } catch (migrationError) {
          warn('レガシー写真の移行に失敗しました', {
            photoId: photo.id,
            message: migrationError?.message
          })
        }
      }

      await saveDatabase()
      pending = await getPhotosPendingStorageMigration(25)
    }

    if (migratedCount > 0) {
      info('レガシー写真データを移行しました', { migratedCount })
    }
  } catch (err) {
    error('レガシー写真移行エラー', err)
  } finally {
    showLoading(false)
  }
}

/**
 * ファイルをData URIに変換
 */
function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function dataUriToBlob(dataUri) {
  const matches = dataUri.match(/^data:(.*?)(;base64)?,(.*)$/)
  if (!matches) {
    throw new Error('DATA_URI_PARSE_FAILED')
  }

  const mimeType = matches[1] || 'application/octet-stream'
  const isBase64 = matches[2] === ';base64'
  const dataPart = matches[3] || ''

  const binaryString = isBase64 ? decodeBase64(dataPart) : decodeURIComponent(dataPart)
  const buffer = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i)
  }

  return new Blob([buffer], { type: mimeType })
}

function decodeBase64(data) {
  if (typeof atob === 'function') {
    return atob(data)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data, 'base64').toString('binary')
  }
  throw new Error('BASE64_DECODE_UNSUPPORTED')
}

function getExtensionFromMime(mimeType) {
  if (typeof mimeType !== 'string') {
    return 'jpg'
  }

  if (mimeType.includes('png')) {
    return 'png'
  }
  if (mimeType.includes('webp')) {
    return 'webp'
  }
  if (mimeType.includes('gif')) {
    return 'gif'
  }
  if (mimeType.includes('bmp')) {
    return 'bmp'
  }
  return 'jpg'
}

/**
 * アルバムをロード
 */
async function loadAlbums() {
  try {
    state.albums = await getAllAlbums({
      sortBy: state.sortBy,
      sortOrder: state.sortOrder
    })
    // currentAlbumId で現在のアルバムを追跡（日付ではなくIDベース）
    if (state.currentAlbumId) {
      const current = state.albums.find(a => a.id === state.currentAlbumId)
      if (current) {
        state.currentAlbumTitle = current.title && current.title.trim().length > 0
          ? current.title.trim()
          : formatDateJapanese(current.date)
      }
    }
    renderAlbums()
  } catch (err) {
    error('アルバムロードエラー', err)
  }
}

/**
 * アルバム一覧をレンダリング
 */
function renderAlbums() {
  if (state.albums.length === 0) {
    ui.albumsContainer.innerHTML = `
      <div class="empty-state">
        <p>アルバムがありません</p>
        <p class="empty-state-hint">「アルバム作成」から日付を登録し、各アルバム内の「写真を追加」ボタンで画像を選択してください</p>
      </div>
    `
    return
  }
  
  ui.albumsContainer.innerHTML = state.albums.map((album, index) => {
    const displayTitle = album.title && album.title.trim().length > 0
      ? escapeHtml(album.title.trim())
      : escapeHtml(formatDateJapanese(album.date))
    const displayDate = escapeHtml(formatDateJapanese(album.date))
    const thumbnailSrc = album.thumbnailUri || (album.photos && album.photos[0] ? album.photos[0].previewUri : null)
    const thumbnailContent = thumbnailSrc
      ? `<img src="${thumbnailSrc}" alt="${displayTitle}" loading="lazy">`
      : '<div class="album-placeholder"><span>サムネイル未設定</span></div>'

    return `
      <div class="album-card" draggable="false" data-album-date="${album.date}" data-album-id="${album.id}" data-album-index="${index}">
        <div class="album-thumbnail">
          ${thumbnailContent}
        </div>
        <div class="album-info">
          <h3 class="album-title-text">${displayTitle}</h3>
          <p class="album-meta-date">${displayDate}</p>
          <p class="album-count">${album.photoCount}枚</p>
          <div class="album-actions">
            <button class="btn-rename-album" data-album-id="${album.id}" data-album-date="${album.date}" title="アルバム名を変更">名前</button>
            <button class="btn-delete-album" data-album-id="${album.id}" data-album-date="${album.date}" title="このアルバムを削除">削除</button>
          </div>
        </div>
      </div>
    `
  }).join('')
  
  // ドラッグ&ドロップハンドラを設定
  setupAlbumDragDrop()
  
  // 削除ボタンハンドラを設定
  setupAlbumDeleteButtons()
  setupAlbumRenameButtons()
}

/**
 * アルバムのドラッグ&ドロップを設定
 * NOTE: renderAlbums() 後に呼び出し、イベントリスナーの重複登録を防止
 * UPDATED: ドラッグ機能は完全に無効化 (draggable=false)
 */
function setupAlbumDragDrop() {
  const albumCards = ui.albumsContainer.querySelectorAll('.album-card')
  
  albumCards.forEach(card => {
    // click: アルバムクリック時のみ
    card.addEventListener('click', handleAlbumClick, { once: false })
  })
}

function handleAlbumDragStart(e) {
  state.draggedAlbumElement = this
  const parsedIndex = parseInt(this.dataset.albumIndex, 10)
  state.draggedAlbumIndex = Number.isNaN(parsedIndex) ? null : parsedIndex
  e.dataTransfer.effectAllowed = 'move'
  try {
    e.dataTransfer.setData('text/plain', this.dataset.albumDate || '')
  } catch (err) {
    warn('ドラッグデータ設定エラー', err)
  }
  this.classList.add('dragging')
}

function handleAlbumDragEnd(e) {
  this.classList.remove('dragging')
  state.draggedAlbumElement = null
  state.draggedAlbumIndex = null
}

function handleAlbumDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (state.draggedAlbumElement && state.draggedAlbumElement !== this) {
    this.classList.add('drag-over')
  }
}

function handleAlbumDragLeave(e) {
  this.classList.remove('drag-over')
}

async function handleAlbumDrop(e) {
  e.preventDefault()
  this.classList.remove('drag-over')
  
  const fromIndex = Number.isInteger(state.draggedAlbumIndex)
    ? state.draggedAlbumIndex
    : parseInt(this.dataset.albumIndex, 10)
  const toIndex = parseInt(this.dataset.albumIndex, 10)

  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
    warn('アルバムインデックスの取得に失敗しました', { fromIndex, toIndex })
    return
  }

  if (state.draggedAlbumElement && state.draggedAlbumElement !== this) {
    await reorderAlbumsByIndex(fromIndex, toIndex)
  }
}

function handleAlbumClick(e) {
  // 削除ボタンクリックは無視
  if (e.target.closest('.btn-delete-album') || e.target.closest('.btn-rename-album')) {
    return
  }
  
  const albumId = parseInt(this.dataset.albumId, 10)
  const albumDate = this.dataset.albumDate
  showAlbumView(albumDate, albumId)
}

/**
 * アルバム順序をスワップ
 */
async function reorderAlbumsByIndex(fromIndex, toIndex) {
  try {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
      throw new Error('アルバムインデックスが不正です')
    }

    if (fromIndex < 0 || fromIndex >= state.albums.length || toIndex < 0 || toIndex >= state.albums.length) {
      throw new Error('アルバムインデックスが範囲外です')
    }

    if (fromIndex === toIndex) {
      state.draggedAlbumIndex = null
      return
    }

    const reordered = [...state.albums]
    const [movedAlbum] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, movedAlbum)

    state.albums = reordered
    state.draggedAlbumIndex = null
    
    // 新しい順序でDB更新
    const albumDates = state.albums.map(a => a.date)
    await updateAlbumOrder(albumDates)
    
    // UIを再レンダリング
    renderAlbums()
    info('アルバム順序を更新')
  } catch (err) {
    error('アルバム順序更新エラー', err)
  }
}

/**
 * アルバムビューを表示
 */
function showAlbumView(albumDate, albumId = null) {
  state.currentAlbumDate = albumDate
  
  // albumId が指定された場合はそれを優先使用、なければ日付で検索
  let album
  if (albumId) {
    album = state.albums.find(a => a.id === albumId)
  } else {
    album = state.albums.find(a => a.date === albumDate)
  }
  
  if (!album) {
    error('アルバムが見つかりません', { albumDate, albumId })
    return
  }

  state.currentAlbumId = album.id
  state.currentAlbumTitle = album.title && album.title.trim().length > 0
    ? album.title.trim()
    : formatDateJapanese(album.date)
  ui.albumTitle.textContent = state.currentAlbumTitle
  if (ui.albumMeta) {
    ui.albumMeta.textContent = formatDateJapanese(album.date)
  }
  
  if (!album.photos || album.photos.length === 0) {
    ui.tileGrid.innerHTML = `
      <div class="empty-state">
        <p>このアルバムに写真がありません</p>
      </div>
    `
  } else {
    ui.tileGrid.innerHTML = album.photos.map(photo => {
      const isThumbnail = typeof album.thumbnailUri === 'string' && album.thumbnailUri === photo.previewUri
      const tileClasses = ['tile']
      if (isThumbnail) {
        tileClasses.push('tile--thumbnail')
      }

      return `
        <div class="${tileClasses.join(' ')}" data-photo-id="${photo.id}">
          <img src="${photo.previewUri}" alt="${escapeHtml(photo.fileName)}" loading="lazy">
          <div class="tile-actions">
            <button class="btn-set-thumbnail${isThumbnail ? ' is-active' : ''}" data-photo-id="${photo.id}" title="アルバムサムネイルに設定">${isThumbnail ? '★' : '☆'}</button>
            <button class="btn-delete-photo" data-photo-id="${photo.id}" title="削除">✕</button>
          </div>
        </div>
      `
    }).join('')
    
    // タイルクリック＆削除ハンドラを設定
    setupTileHandlers(album.photos)
  }
  
  ui.mainPage.classList.add('hidden')
  ui.albumView.classList.remove('hidden')
}

/**
 * タイルのクリック＆削除ハンドラを設定
 */
function setupTileHandlers(photos) {
  const tiles = ui.tileGrid.querySelectorAll('.tile')
  
  tiles.forEach(tile => {
    // タイルクリック: フルサイズ表示
    tile.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-delete-photo') || e.target.closest('.btn-set-thumbnail')) {
        return
      }
      
      const photoId = parseInt(tile.dataset.photoId)
      const photo = photos.find(p => p.id === photoId)
      if (photo) {
        await showFullsizeModal(photo)
      }
    })
    
    const thumbnailBtn = tile.querySelector('.btn-set-thumbnail')
    if (thumbnailBtn) {
      thumbnailBtn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const photoId = parseInt(thumbnailBtn.dataset.photoId)
        const photo = photos.find(p => p.id === photoId)
        if (photo) {
          await setThumbnailForPhoto(photo)
        }
      })
    }
    
    // 削除ボタン
    const deleteBtn = tile.querySelector('.btn-delete-photo')
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation()
        
        const photoId = parseInt(deleteBtn.dataset.photoId)
        if (confirm('この写真を削除しますか？')) {
          const photo = photos.find(p => p.id === photoId)
          if (photo) {
            await deletePhoto(photo)
          }
        }
      })
    }
  })
}

/**
 * 写真を削除
 */
async function deletePhoto(photo) {
  try {
    showLoading(true)
    // albumId で正確なアルバムを取得（日付ではなくID）
    const albumBefore = state.albums.find(a => a.id === state.currentAlbumId)
    const wasThumbnail = albumBefore && albumBefore.thumbnailUri === photo.previewUri

    await deletePhotoById(photo.id)
    if (photo.storageKey) {
      try {
        await deleteStoredPhoto(photo.storageKey)
      } catch (storageErr) {
        warn('ストレージからの写真削除に失敗しました', storageErr)
      }
    }
    await loadAlbums()

    const refreshedAlbum = state.albums.find(a => a.id === state.currentAlbumId)

    if (refreshedAlbum && refreshedAlbum.photoCount > 0) {
      if (wasThumbnail) {
        const fallbackPhoto = refreshedAlbum.photos[0] || null
        await setAlbumThumbnail(state.currentAlbumId, fallbackPhoto ? fallbackPhoto.previewUri : null)
        await loadAlbums()
      }
      showAlbumView(state.currentAlbumDate, state.currentAlbumId)
    } else if (refreshedAlbum) {
      await setAlbumThumbnail(state.currentAlbumId, null)
      await loadAlbums()
      showAlbumView(state.currentAlbumDate, state.currentAlbumId)
    } else {
      showMainPage()
    }
    info('写真を削除', { photoId: photo.id })
  } catch (err) {
    error('写真削除エラー', err)
    alert('写真の削除に失敗しました: ' + err.message)
  } finally {
    showLoading(false)
  }
}

async function setThumbnailForPhoto(photo) {
  try {
    showLoading(true)
    await setAlbumThumbnail(state.currentAlbumId, photo ? photo.previewUri : null)
    await loadAlbums()
    if (state.currentAlbumId) {
      showAlbumView(state.currentAlbumDate, state.currentAlbumId)
    }
    info('アルバムサムネイルを更新', { albumId: state.currentAlbumId, photoId: photo?.id })
  } catch (err) {
    error('アルバムサムネイル更新エラー', err)
    alert('サムネイルの設定に失敗しました: ' + err.message)
  } finally {
    showLoading(false)
  }
}

/**
 * メインページを表示
 */
function showMainPage() {
  ui.mainPage.classList.remove('hidden')
  ui.albumView.classList.add('hidden')
  state.currentAlbumDate = null
  state.currentAlbumTitle = ''
}

/**
 * フルサイズモーダルを表示
 */
async function showFullsizeModal(photo) {
  if (!photo) {
    return
  }

  cleanupCurrentPhotoResources()

  state.currentPhoto = photo
  ui.fullsizeImage.dataset.photoFileName = photo.fileName

  const previewSource = photo.previewUri || ''
  if (previewSource) {
    ui.fullsizeImage.src = previewSource
  } else {
    ui.fullsizeImage.removeAttribute('src')
  }

  ui.fullsizeModal.classList.remove('hidden')
  document.body.style.overflow = 'hidden'

  if (photo.storageKey) {
    try {
      const blob = await getOriginalPhotoBlob(photo.storageKey)
      if (blob) {
        state.currentPhotoBlob = blob
        const objectUrl = URL.createObjectURL(blob)
        state.currentPhotoObjectUrl = objectUrl
        ui.fullsizeImage.src = objectUrl
        return
      }
    } catch (storageErr) {
      warn('フルサイズ画像の読み込みに失敗しました', storageErr)
    }
  }

  if (!state.currentPhotoBlob && previewSource) {
    try {
      state.currentPhotoBlob = dataUriToBlob(previewSource)
    } catch (previewErr) {
      warn('プレビュー画像の変換に失敗しました', previewErr)
    }
  }
}

/**
 * フルサイズモーダルを非表示
 */
function hideFullsizeModal() {
  cleanupCurrentPhotoResources()
  ui.fullsizeModal.classList.add('hidden')
  document.body.style.overflow = ''
}

function cleanupCurrentPhotoResources() {
  if (state.currentPhotoObjectUrl) {
    URL.revokeObjectURL(state.currentPhotoObjectUrl)
  }
  state.currentPhotoObjectUrl = null
  state.currentPhotoBlob = null
  state.currentPhoto = null
}

/**
 * 写真をダウンロード
 */
async function downloadCurrentPhoto() {
  try {
    if (!state.currentPhoto) {
      alert('ダウンロード対象の写真が選択されていません')
      return
    }

    if (!state.currentPhotoBlob && state.currentPhoto.storageKey) {
      try {
        const blob = await getOriginalPhotoBlob(state.currentPhoto.storageKey)
        if (blob) {
          state.currentPhotoBlob = blob
        }
      } catch (storageErr) {
        warn('オリジナル写真の取得に失敗しました', storageErr)
      }
    }

    if (!state.currentPhotoBlob && state.currentPhoto.previewUri) {
      state.currentPhotoBlob = dataUriToBlob(state.currentPhoto.previewUri)
    }

    if (!state.currentPhotoBlob) {
      alert('ダウンロードできる写真データが見つかりません')
      return
    }

    const blob = state.currentPhotoBlob
    const fileName = buildDownloadFileName(state.currentPhoto, blob.type)
    const objectUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(objectUrl)
    info('写真をダウンロード', { fileName, size: blob.size })
  } catch (err) {
    error('ダウンロードエラー', err)
    alert('写真のダウンロードに失敗しました: ' + (err?.message || '不明なエラー'))
  }
}

function buildDownloadFileName(photo, mimeTypeFromBlob) {
  const fallbackName = photo.fileName && photo.fileName.trim().length > 0
    ? photo.fileName.trim()
    : `photo-${photo.id || Date.now()}`

  if (fallbackName.includes('.')) {
    return fallbackName
  }

  const mimeType = mimeTypeFromBlob || photo.mimeType || 'image/jpeg'
  return `${fallbackName}.${getExtensionFromMime(mimeType)}`
}

/**
 * ローディング表示
 */
function showLoading(show) {
  if (show) {
    ui.loading.classList.remove('hidden')
  } else {
    ui.loading.classList.add('hidden')
  }
}

async function handleRenameAlbum(albumId, albumDate) {
  if (!albumId || !albumDate) {
    return
  }

  const album = state.albums.find(a => a.id === albumId)
  if (!album) {
    alert('対象のアルバムが見つかりませんでした')
    return
  }

  const input = prompt('新しいアルバム名を入力してください')
  if (input === null) {
    return
  }

  const normalizedTitle = input.trim()
  if (normalizedTitle.length === 0) {
    alert('アルバム名は1文字以上で入力してください')
    return
  }

  try {
    showLoading(true)
    const updatedTitle = await updateAlbumTitle(album.id, normalizedTitle)
    info('アルバム名を更新', { albumId: album.id, title: updatedTitle })
    await loadAlbums()

    if (state.currentAlbumDate === album.date) {
      showAlbumView(album.date, album.id)
    }

    alert(`アルバム名を「${updatedTitle}」に更新しました`)
  } catch (err) {
    error('アルバム名更新エラー', err)
    alert('アルバム名の更新に失敗しました: ' + err.message)
  } finally {
    showLoading(false)
  }
}

function setupAlbumRenameButtons() {
  const renameButtons = ui.albumsContainer.querySelectorAll('.btn-rename-album')

  renameButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const albumId = parseInt(btn.dataset.albumId, 10)
      const albumDate = btn.dataset.albumDate
      await handleRenameAlbum(albumId, albumDate)
    })
  })
}

/**
 * アルバム削除ボタンを設定
 */
function setupAlbumDeleteButtons() {
  const deleteButtons = ui.albumsContainer.querySelectorAll('.btn-delete-album')
  
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      
      const albumId = parseInt(btn.dataset.albumId, 10)
      const album = state.albums.find(a => a.id === albumId)
      if (album && confirm(`${album.title}を削除しますか？`)) {
        await deleteAlbum(albumId)
      }
    })
  })
}

/**
 * アルバムを削除（関連する写真もすべて削除）
 */
async function deleteAlbum(albumId) {
  try {
    showLoading(true)

    const album = state.albums.find(a => a.id === albumId)
    if (!album) {
      alert('対象のアルバムが見つかりませんでした')
      return
    }

    let photosForDeletion = album?.photos ?? []
    if (!photosForDeletion.length) {
      photosForDeletion = await getPhotosByDate(album.date)
    }

    for (const target of photosForDeletion) {
      if (target.storageKey) {
        try {
          await deleteStoredPhoto(target.storageKey)
        } catch (storageErr) {
          warn('写真ストレージ削除エラー', storageErr)
        }
      }
    }

    // albumIdに基づいてアルバムを削除
    const { deleteAlbumById } = await import('./services/DatabaseService.js')
    await deleteAlbumById(albumId)
    
    // 状態から削除
    state.albums = state.albums.filter(a => a.id !== albumId)
    
    // UIを更新
    renderAlbums()
    if (state.currentAlbumDate === album.date) {
      state.currentAlbumDate = null
      state.currentAlbumTitle = ''
      showMainPage()
    }
    info('アルバムを削除', { albumId })
  } catch (err) {
    error('アルバム削除エラー', err)
    alert('アルバムの削除に失敗しました: ' + err.message)
  } finally {
    showLoading(false)
  }
}

async function handleCreateAlbumClick() {
  showCreateAlbumModal()
}

/**
 * アルバム作成モーダルを表示
 */
function showCreateAlbumModal() {
  if (!ui.createAlbumModal) {
    warn('アルバム作成モーダルが見つかりません')
    return
  }

  // 今日の日付をデフォルト値に設定
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  
  if (ui.albumTitleInput) {
    ui.albumTitleInput.value = ''
  }
  
  if (ui.albumDateInput) {
    ui.albumDateInput.value = todayIso
    ui.albumDateInput.focus()
  }

  ui.createAlbumModal.classList.remove('hidden')
}

/**
 * アルバム作成モーダルを非表示
 */
function hideCreateAlbumModal() {
  if (ui.createAlbumModal) {
    ui.createAlbumModal.classList.add('hidden')
  }
}

/**
 * アルバムを作成（モーダルから）
 */
async function createAlbumFromModal() {
  const titleInput = ui.albumTitleInput?.value?.trim() || ''
  const dateInput = ui.albumDateInput?.value?.trim() || ''

  if (!dateInput) {
    alert('日付を選択してください')
    return
  }

  let normalizedDate
  try {
    normalizedDate = formatDate(dateInput)
  } catch (parseError) {
    alert('日付の形式が不正です')
    return
  }

  try {
    showLoading(true)
    hideCreateAlbumModal()

    const result = await createManualAlbum({
      dateValue: normalizedDate,
      titleValue: titleInput || formatDateJapanese(normalizedDate)
    })
    
    await loadAlbums()

    if (result.created) {
      alert(`「${result.albumTitle}」を作成しました`)
    } else {
      alert(`「${result.albumTitle}」は既に存在します`)
    }
  } catch (err) {
    error('アルバム作成エラー', err)
    alert('アルバムの作成に失敗しました: ' + err.message)
  } finally {
    showLoading(false)
  }
}

/**
 * データをすべてクリア（確認付き）
 */
async function clearAllData() {
  if (!confirm('すべてのアルバムと写真を削除します。この操作は取り消せません。本当にいいですか？')) {
    return
  }
  
  if (!confirm('【最終確認】本当に削除しますか？')) {
    return
  }
  
  try {
    showLoading(true)
    
    await clearDatabase()
    await clearAllPhotos()
    
    // 状態をリセット
    state.albums = []
    state.currentAlbumDate = null
    cleanupCurrentPhotoResources()
    
    // UIを更新
    showMainPage()
    renderAlbums()
    info('すべてのデータをクリア')
    alert('すべてのデータを削除しました')
  } catch (err) {
    error('データクリアエラー', err)
    alert('データのクリアに失敗しました: ' + err.message)
  } finally {
    showLoading(false)
  }
}

// グローバルに公開（コンソール操作用）
window.clearAllData = clearAllData

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', initialize)
