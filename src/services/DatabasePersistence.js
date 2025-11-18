const DB_KEY = 'photo-album-organizer-db'
const SNAPSHOT_DB_NAME = 'photo-album-organizer-db'
const SNAPSHOT_STORE_NAME = 'snapshots'
const SNAPSHOT_KEY = 'primary'
const SNAPSHOT_DB_VERSION = 1

let snapshotDbPromise = null

function isIndexedDbSupported() {
  return typeof indexedDB !== 'undefined'
}

function isLocalStorageAvailable() {
  try {
    if (typeof localStorage === 'undefined') {
      return false
    }
    const testKey = '__db_persistence_test__'
    localStorage.setItem(testKey, 'ok')
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

function openSnapshotDatabase() {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      resolve(null)
      return
    }

    const request = indexedDB.open(SNAPSHOT_DB_NAME, SNAPSHOT_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) {
        db.createObjectStore(SNAPSHOT_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB open request was blocked'))
  })
}

async function getSnapshotDatabase() {
  if (!isIndexedDbSupported()) {
    return null
  }

  if (!snapshotDbPromise) {
    snapshotDbPromise = openSnapshotDatabase().catch((err) => {
      snapshotDbPromise = null
      throw err
    })
  }

  return snapshotDbPromise
}

function uint8ArrayToBase64(data) {
  if (!(data instanceof Uint8Array)) {
    return ''
  }

  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, Math.min(i + chunkSize, data.length))
    binary += String.fromCharCode(...chunk)
  }

  if (typeof btoa === 'function') {
    return btoa(binary)
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data).toString('base64')
  }

  return ''
}

function base64ToUint8Array(base64) {
  if (typeof base64 !== 'string' || base64.length === 0) {
    return null
  }

  try {
    let binaryString
    if (typeof atob === 'function') {
      binaryString = atob(base64)
    } else if (typeof Buffer !== 'undefined') {
      binaryString = Buffer.from(base64, 'base64').toString('binary')
    } else {
      return null
    }

    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

function safeGetLocalStorage(key) {
  if (!isLocalStorageAvailable()) {
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetLocalStorage(key, value) {
  if (!isLocalStorageAvailable()) {
    return
  }
  try {
    localStorage.setItem(key, value)
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      // Remove the key so later logic can fall back to IndexedDB
      try {
        localStorage.removeItem(key)
      } catch {
        /* noop */
      }
    } else {
      throw err
    }
  }
}

function safeRemoveLocalStorage(key) {
  if (!isLocalStorageAvailable()) {
    return
  }
  try {
    localStorage.removeItem(key)
  } catch {
    /* noop */
  }
}

async function readSnapshotFromIndexedDb() {
  const db = await getSnapshotDatabase()
  if (!db) {
    return null
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SNAPSHOT_STORE_NAME, 'readonly')
    const store = transaction.objectStore(SNAPSHOT_STORE_NAME)
    const request = store.get(SNAPSHOT_KEY)

    request.onsuccess = () => {
      const result = request.result
      if (!result) {
        resolve(null)
        return
      }
      if (result instanceof Uint8Array) {
        resolve(result)
      } else if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result))
      } else if (ArrayBuffer.isView(result)) {
        resolve(new Uint8Array(result.buffer.slice(0)))
      } else {
        resolve(null)
      }
    }

    request.onerror = () => reject(request.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

async function writeSnapshotToIndexedDb(data) {
  const db = await getSnapshotDatabase()
  if (!db) {
    return false
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(SNAPSHOT_STORE_NAME)
    const payload = data instanceof Uint8Array ? data : new Uint8Array(data || [])
    const request = store.put(payload, SNAPSHOT_KEY)

    transaction.oncomplete = () => resolve(true)
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
    request.onerror = () => reject(request.error)
  })
}

async function deleteSnapshotFromIndexedDb() {
  const db = await getSnapshotDatabase()
  if (!db) {
    return false
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(SNAPSHOT_STORE_NAME)
    const request = store.delete(SNAPSHOT_KEY)

    transaction.oncomplete = () => resolve(true)
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
    request.onerror = () => reject(request.error)
  })
}

export async function loadDatabaseSnapshot() {
  try {
    const snapshot = await readSnapshotFromIndexedDb()
    if (snapshot instanceof Uint8Array && snapshot.length > 0) {
      safeRemoveLocalStorage(DB_KEY)
      return snapshot
    }
  } catch (err) {
    console.warn('[DatabasePersistence] IndexedDB 読み込みに失敗しました。ローカルストレージへフォールバックします。', err)
  }

  const stored = safeGetLocalStorage(DB_KEY)
  if (stored) {
    const decoded = base64ToUint8Array(stored)
    if (decoded) {
      if (isIndexedDbSupported()) {
        try {
          await writeSnapshotToIndexedDb(decoded)
          safeRemoveLocalStorage(DB_KEY)
        } catch (err) {
          console.warn('[DatabasePersistence] IndexedDB への移行に失敗しました。', err)
        }
      }
      return decoded
    }
  }

  return null
}

export async function saveDatabaseSnapshot(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('saveDatabaseSnapshot expects Uint8Array data')
  }

  if (isIndexedDbSupported()) {
    try {
      const stored = await writeSnapshotToIndexedDb(data)
      if (stored) {
        safeRemoveLocalStorage(DB_KEY)
        return
      }
    } catch (err) {
      console.warn('[DatabasePersistence] IndexedDB 書き込みに失敗しました。ローカルストレージへフォールバックします。', err)
    }
  }

  const base64 = uint8ArrayToBase64(data)
  if (base64) {
    safeSetLocalStorage(DB_KEY, base64)
  }
}

export async function clearDatabaseSnapshot() {
  if (isIndexedDbSupported()) {
    try {
      await deleteSnapshotFromIndexedDb()
    } catch (err) {
      console.warn('[DatabasePersistence] IndexedDB スナップショット削除に失敗しました。', err)
    }
  }

  safeRemoveLocalStorage(DB_KEY)
}

export default {
  loadDatabaseSnapshot,
  saveDatabaseSnapshot,
  clearDatabaseSnapshot
}
