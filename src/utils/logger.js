/**
 * ロギング機構
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

let currentLogLevel = LOG_LEVELS.INFO

/**
 * ログレベルを設定
 * @param {string} level - 'DEBUG', 'INFO', 'WARN', 'ERROR'
 */
export function setLogLevel(level) {
  currentLogLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO
}

/**
 * エラーオブジェクトから情報を抽出
 * @param {any} err
 * @returns {string}
 */
function extractErrorInfo(err) {
  if (err instanceof Error) {
    return `${err.message} | Stack: ${err.stack}`
  }
  if (typeof err === 'string') {
    return err
  }
  if (typeof err === 'object') {
    try {
      return JSON.stringify(err)
    } catch (e) {
      return Object.toString.call(err)
    }
  }
  return String(err)
}

/**
 * ログメッセージをフォーマット
 * @param {string} level
 * @param {string} message
 * @param {any} data
 * @returns {string}
 */
function formatLog(level, message, data) {
  const timestamp = new Date().toISOString()
  let dataStr = ''
  
  if (data) {
    if (data instanceof Error || (data && data.message && data.stack)) {
      dataStr = ': ' + extractErrorInfo(data)
    } else if (typeof data === 'object') {
      dataStr = ': ' + JSON.stringify(data)
    } else {
      dataStr = ': ' + String(data)
    }
  }
  
  return `[${timestamp}] [${level}] ${message}${dataStr}`
}

export function debug(message, data) {
  if (currentLogLevel <= LOG_LEVELS.DEBUG) {
    console.debug(formatLog('DEBUG', message, data))
  }
}

export function info(message, data) {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    console.info(formatLog('INFO', message, data))
  }
}

export function warn(message, data) {
  if (currentLogLevel <= LOG_LEVELS.WARN) {
    console.warn(formatLog('WARN', message, data))
  }
}

export function error(message, data) {
  if (currentLogLevel <= LOG_LEVELS.ERROR) {
    const logMsg = formatLog('ERROR', message, data)
    console.error(logMsg)
    // エラーオブジェクトの場合、スタックトレースも表示
    if (data instanceof Error) {
      console.error(data)
    }
  }
}

export default {
  setLogLevel,
  debug,
  info,
  warn,
  error
}
