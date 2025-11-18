/**
 * ファイル検証ユーティリティ
 * SEC-002: ファイル型検証（拡張子詐称対応）
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

/**
 * ファイル拡張子を取得（セキュリティ: 小文字化）
 * @param {string} fileName
 * @returns {string}
 */
function getFileExtension(fileName) {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

/**
 * ファイルが有効な画像かを検証（拡張子詐称検出）
 * @param {File} file
 * @returns {{valid: boolean, error?: string}}
 */
export function validateImageFile(file) {
  // 1. MIME 型チェック（必須）
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `ファイル型が許可されていません: ${file.type}（JPEG, PNG, WebP のみ対応）`
    }
  }

  // 2. ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `ファイルサイズが大きすぎます: ${Math.round(file.size / 1024 / 1024)}MB（最大100MB）`
    }
  }

  // 3. 拡張子チェック（詐称検出）
  const extension = getFileExtension(file.name)
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `ファイル拡張子が許可されていません: .${extension}（.jpg, .jpeg, .png, .webp のみ対応）`
    }
  }

  // 4. MIME型と拡張子のマッピングを検証（詐称検出）
  const mimeToExtensions = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/jpg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp']
  }

  const allowedForMime = mimeToExtensions[file.type] || []
  if (!allowedForMime.includes(extension)) {
    return {
      valid: false,
      error: `ファイル型と拡張子が一致しません: ${file.type} に対して .${extension} は無効（詐称検出）`
    }
  }

  return { valid: true }
}

/**
 * ファイルリストを検証
 * @param {FileList} files
 * @returns {{valid: File[], invalid: Array<{file: File, error: string}>}}
 */
export function validateFileList(files) {
  const valid = []
  const invalid = []

  Array.from(files).forEach(file => {
    const result = validateImageFile(file)
    if (result.valid) {
      valid.push(file)
    } else {
      invalid.push({ file, error: result.error })
    }
  })

  return { valid, invalid }
}

/**
 * MIME型が サポートされているか確認
 * @param {string} mime
 * @returns {boolean}
 */
export function isSupportedMimeType(mime) {
  return ALLOWED_TYPES.includes(mime)
}
