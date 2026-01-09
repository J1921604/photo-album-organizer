/**
 * 日時ユーティリティ
 */

/**
 * Exifメタデータから撮影日時を抽出
 * @param {File} file - 写真ファイル
 * @returns {Promise<Date>} 撮影日時（取得できない場合はファイル変更日時）
 */
export async function extractPhotoDate(file) {
  try {
    // ファイル変更日時をデフォルトとして取得
    let photoDate = new Date(file.lastModified)
    
    // ここでExif処理を追加可能（ex: exif-js ライブラリ）
    // 現在は簡易実装
    
    return photoDate
  } catch (error) {
    console.warn('日時抽出エラー:', error)
    return new Date()
  }
}

function coerceToDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = parseFlexibleDate(value)
    if (parsed) {
      return parsed
    }
  }

  return null
}

function parseFlexibleDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const numericDate = new Date(value)
    return Number.isNaN(numericDate.valueOf()) ? null : numericDate
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const normalizedSeparators = trimmed
    .replace(/[年月]/g, '-')
    .replace(/[\.\/]/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '')

  const match = normalizedSeparators.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) {
    const [, year, month, day] = match
    return createUtcDate(Number(year), Number(month), Number(day))
  }

  const fallbackDate = new Date(trimmed)
  if (!Number.isNaN(fallbackDate.valueOf())) {
    return fallbackDate
  }

  return null
}

function createUtcDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  if (month < 1 || month > 12) {
    return null
  }

  if (day < 1 || day > 31) {
    return null
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day))

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    return null
  }

  return utcDate
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 * @param {Date|string|number} value
 * @returns {string}
 */
export function formatDate(value) {
  const date = coerceToDate(value)
  if (!date) {
    throw new TypeError('Invalid date value provided to formatDate')
  }

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 日付を日本語で表示（例: 2025年11月15日）
 * @param {Date|string|number} value
 * @returns {string}
 */
export function formatDateJapanese(value) {
  const date = coerceToDate(value)
  if (!date) {
    throw new TypeError('Invalid date value provided to formatDateJapanese')
  }

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getUTCDay()]
  return `${year}年${month}月${day}日(${dayOfWeek})`
}

/**
 * 2つの日付が同じ日かを判定
 * @param {Date|string|number} date1
 * @param {Date|string|number} date2
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  const normalizedA = coerceToDate(date1)
  const normalizedB = coerceToDate(date2)

  if (!normalizedA || !normalizedB) {
    return false
  }

  return formatDate(normalizedA) === formatDate(normalizedB)
}
