/**
 * セキュリティユーティリティ
 * SEC-004: 機密情報非含有エラーメッセージ
 */

/**
 * ユーザーフレンドリーなエラーメッセージを生成
 * （ファイルパス、スタックトレースなど機密情報を非含有）
 * @param {Error} err
 * @param {string} context
 * @returns {string}
 */
export function getUserFriendlyErrorMessage(err, context = 'エラーが発生しました') {
  // デバッグ情報をログ（内部用）
  console.error(`[DEBUG] ${context}:`, err)
  
  // ユーザーに表示するメッセージ（一般的なテキスト）
  const errorMap = {
    'Cannot find dependency': '依存関係エラー',
    'Network error': 'ネットワークエラーが発生しました',
    'Timeout': 'タイムアウト',
    'Permission denied': 'アクセス権限がありません',
    'Not found': 'ファイルが見つかりません',
    'Invalid': '無効な入力です'
  }

  // エラーメッセージから機密情報を除去
  let userMessage = context
  
  if (err && err.message) {
    for (const [key, value] of Object.entries(errorMap)) {
      if (err.message.includes(key)) {
        userMessage = value
        break
      }
    }
  }

  return userMessage
}

/**
 * ファイル情報のサニタイズ
 * （フルパスではなく、ファイル名のみを返す）
 * @param {string} filePath
 * @returns {string}
 */
export function sanitizeFilePath(filePath) {
  if (!filePath) return 'unknown'
  // ファイル名のみを抽出
  return filePath.split(/[\\/]/).pop() || 'unknown'
}

/**
 * ログデータから機密情報を削除
 * @param {any} data
 * @returns {any}
 */
export function sanitizeLogData(data) {
  if (!data) return data
  
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth']
  const sanitized = JSON.parse(JSON.stringify(data))
  
  const removeLeaves = (obj) => {
    if (obj === null || typeof obj !== 'object') return
    
    Object.keys(obj).forEach(key => {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        obj[key] = '[REDACTED]'
      } else if (typeof obj[key] === 'object') {
        removeLeaves(obj[key])
      }
    })
  }
  
  removeLeaves(sanitized)
  return sanitized
}

export default {
  getUserFriendlyErrorMessage,
  sanitizeFilePath,
  sanitizeLogData
}
