/**
 * アルバムサービス
 */

import { formatDate, formatDateJapanese } from '../utils/dateUtils.js'
import {
  getPhotosByDate,
  getPhotosByAlbumId,
  getAllAlbumDates,
  createOrUpdateAlbum,
  updateAlbumOrder as updateAlbumOrderDb,
  updateAlbumThumbnail as updateAlbumThumbnailDb,
  updateAlbumTitle as updateAlbumTitleDb
} from './DatabaseService.js'
import { info, error } from '../utils/logger.js'

/**
 * 写真リストから日付別アルバムを生成
 * @param {Array} photos - 写真配列
 * @returns {Object} {日付: 写真配列}
 */
export async function groupPhotosByDate(photos) {
  try {
    const grouped = {}

    photos.forEach(photo => {
      const date = formatDate(photo.photoDate)
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(photo)
    })

    info('写真をグループ化', { count: Object.keys(grouped).length })
    return grouped
  } catch (err) {
    error('グループ化エラー', err)
    throw err
  }
}

/**
 * すべてのアルバムデータを取得
 * @param {Object} options - ソートオプション
 * @param {string} options.sortBy - 'date' | 'title' | 'order' (デフォルト: 'order')
 * @param {string} options.sortOrder - 'asc' | 'desc' (デフォルト: 'asc')
 * @returns {Array} アルバム配列
 */
export async function getAllAlbums(options = {}) {
  try {
    const { sortBy = 'order', sortOrder = 'asc' } = options
    const albumDates = await getAllAlbumDates()
    
    const albums = []
    for (const album of albumDates) {
      // album_id をベースに写真を取得（同日の他アルバムの写真を共有しない）
      const photos = await getPhotosByAlbumId(album.id)
      albums.push({
        id: album.id,
        date: album.date,
        displayOrder: album.displayOrder,
        title: album.title && album.title.trim().length > 0 ? album.title : formatDateJapanese(album.date),
        photoCount: photos.length,
        photos: photos,
        thumbnailUri: album.thumbnailUri || null
      })
    }

    // ソート処理
    let sorted = albums
    if (sortBy === 'date') {
      sorted = albums.sort((a, b) => {
        const comparison = a.date.localeCompare(b.date)
        return sortOrder === 'desc' ? -comparison : comparison
      })
    } else if (sortBy === 'title') {
      sorted = albums.sort((a, b) => {
        const comparison = a.title.localeCompare(b.title, 'ja')
        return sortOrder === 'desc' ? -comparison : comparison
      })
    } else {
      // デフォルト: displayOrder でソート
      sorted = albums.sort((a, b) => {
        const comparison = a.displayOrder - b.displayOrder
        return sortOrder === 'desc' ? -comparison : comparison
      })
    }

    return sorted
  } catch (err) {
    error('アルバム取得エラー', err)
    return []
  }
}

/**
 * アルバム順序を更新
 * @param {Array} albumDates - 新しい順序の日付配列
 * @returns {Promise<void>}
 */
export async function updateAlbumOrder(albumDates) {
  try {
    await updateAlbumOrderDb(albumDates)
    info('アルバム順序更新完了', { count: albumDates.length })
  } catch (err) {
    error('アルバム順序更新エラー', err)
    throw err
  }
}

/**
 * 新しい写真セットでアルバムを初期化
 * @param {Array} photos - 新規写真配列
 * @returns {Promise<Object>} グループ化されたアルバム
 */
export async function initializeAlbumsWithPhotos(photos) {
  try {
    const grouped = await groupPhotosByDate(photos)
    const dates = Object.keys(grouped).sort().reverse()

    const existingAlbums = await getAllAlbumDates()
    const existingMap = new Map(existingAlbums.map(album => [album.date, {
      ...album,
      title: album.title && album.title.trim().length > 0 ? album.title : formatDateJapanese(album.date)
    }]))
    const existingDates = existingAlbums.map(a => a.date)
    
    // 既存アルバムに存在しない新規日付のみを追加
    const newDates = dates.filter(date => !existingDates.includes(date))
    
    const maxOrder = existingAlbums.length > 0
      ? Math.max(...existingAlbums.map(a => a.displayOrder))
      : -1

    for (let i = 0; i < newDates.length; i++) {
      const albumDate = newDates[i]
      const firstPhoto = grouped[albumDate]?.[0] || null
      const defaultTitle = formatDateJapanese(albumDate)
      await createOrUpdateAlbum({
        albumDate,
        displayOrder: maxOrder + 1 + i,
        albumTitle: defaultTitle,
        thumbnailUri: firstPhoto?.previewUri || null
      })
      existingMap.set(albumDate, {
        date: albumDate,
        displayOrder: maxOrder + 1 + i,
        thumbnailUri: firstPhoto?.previewUri || null,
        title: defaultTitle
      })
    }

    for (const date of dates) {
      const album = existingMap.get(date)
      const firstPhoto = grouped[date]?.[0]
      if (firstPhoto && (!album || !album.thumbnailUri)) {
        // Use album.id for thumbnail update, not date
        await updateAlbumThumbnailDb(album.id, firstPhoto.previewUri)
        if (album) {
          album.thumbnailUri = firstPhoto.previewUri
        }
      }
    }

    info('アルバム初期化完了', { newAlbums: newDates.length })
    return grouped
  } catch (err) {
    error('アルバム初期化エラー', err)
    throw err
  }
}

/**
 * 手動でアルバムを作成
 * @param {object|string|Date} value
 * @returns {Promise<{ created: boolean, albumDate: string, albumTitle: string }>}
 */
export async function createManualAlbum(value) {
  try {
    let rawDateInput = value
    let providedTitle = null

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const candidateDate = value.dateValue ?? value.date ?? value.albumDate ?? value.value
      rawDateInput = candidateDate ?? value
      providedTitle = value.titleValue ?? value.title ?? value.albumTitle ?? null
    }

    let albumDate
    try {
      albumDate = formatDate(rawDateInput)
    } catch (parseError) {
      const friendlyError = new Error('日付は YYYY-MM-DD 形式 (例: 2025-11-15) で入力してください。')
      friendlyError.cause = parseError
      throw friendlyError
    }

    // タイトルを正規化
    const normalizedTitle = typeof providedTitle === 'string' && providedTitle.trim().length > 0
      ? providedTitle.trim()
      : formatDateJapanese(albumDate)

    const existingAlbums = await getAllAlbumDates()
    
    // 同じ日付・同じタイトルのアルバムが存在するか確認
    const duplicateAlbum = existingAlbums.find(
      a => a.date === albumDate && a.title === normalizedTitle
    )
    
    if (duplicateAlbum) {
      info('同じ日付・タイトルのアルバムが既に存在するため作成をスキップ', { albumDate, normalizedTitle })
      return { created: false, albumDate, albumTitle: normalizedTitle }
    }

    const nextOrder = existingAlbums.length > 0
      ? Math.max(...existingAlbums.map(a => a.displayOrder)) + 1
      : 0

    await createOrUpdateAlbum({
      albumDate,
      displayOrder: nextOrder,
      albumTitle: normalizedTitle,
      thumbnailUri: null
    })

    info('手動アルバム作成', { albumDate, albumTitle: normalizedTitle })
    return { created: true, albumDate, albumTitle: normalizedTitle }
  } catch (err) {
    error('手動アルバム作成エラー', err)
    throw err
  }
}

/**
 * アルバムサムネイルを設定
 * @param {string} albumDate
 * @param {string|null} thumbnailUri
 * @returns {Promise<void>}
 */
export async function setAlbumThumbnail(albumId, thumbnailUri) {
  try {
    await updateAlbumThumbnailDb(albumId, thumbnailUri)
    info('アルバムサムネイル設定', { albumId })
  } catch (err) {
    error('アルバムサムネイル設定エラー', err)
    throw err
  }
}

/**
 * アルバムタイトルを更新
 * @param {string} albumDate
 * @param {string} albumTitle
 * @returns {Promise<string>}
 */
export async function updateAlbumTitle(albumId, albumTitle) {
  try {
    const normalizedTitle = typeof albumTitle === 'string' ? albumTitle.trim() : ''
    if (normalizedTitle.length === 0) {
      throw new Error('INVALID_ALBUM_TITLE')
    }
    await updateAlbumTitleDb(albumId, normalizedTitle)
    info('アルバムタイトル設定', { albumId })
    return normalizedTitle
  } catch (err) {
    error('アルバムタイトル設定エラー', err)
    throw err
  }
}

export default {
  groupPhotosByDate,
  getAllAlbums,
  updateAlbumOrder,
  initializeAlbumsWithPhotos,
  createManualAlbum,
  setAlbumThumbnail,
  updateAlbumTitle
}
