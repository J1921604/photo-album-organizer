const DB_NAME = 'photo-album-organizer-storage'
const STORE_NAME = 'photos'
const DB_VERSION = 1

let dbPromise = null
const memoryFallbackStore = new Map()

function isIndexedDbSupported() {
  return typeof indexedDB !== 'undefined'
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      resolve(null)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }

    request.onblocked = () => {
      reject(new Error('IndexedDB open request was blocked'))
    }
  })
}

async function getDatabase() {
  if (!isIndexedDbSupported()) {
    return null
  }
  if (!dbPromise) {
    dbPromise = openDatabase()
  }
  return dbPromise
}

export async function initializeStorage() {
  try {
    await getDatabase()
    return true
  } catch (err) {
    console.warn('[StorageService] Failed to initialize IndexedDB. Falling back to in-memory store.', err)
    return false
  }
}

export async function storeOriginalPhoto(key, blob) {
  if (!key) {
    throw new Error('INVALID_STORAGE_KEY')
  }
  if (!(blob instanceof Blob)) {
    throw new Error('INVALID_PHOTO_BLOB')
  }

  if (!isIndexedDbSupported()) {
    memoryFallbackStore.set(key, blob)
    return
  }

  const db = await getDatabase()
  if (!db) {
    memoryFallbackStore.set(key, blob)
    return
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(blob, key)

    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
    request.onerror = () => reject(request.error)
  })
}

export async function getOriginalPhotoBlob(key) {
  if (!key) {
    return null
  }

  if (!isIndexedDbSupported()) {
    return memoryFallbackStore.get(key) || null
  }

  const db = await getDatabase()
  if (!db) {
    return memoryFallbackStore.get(key) || null
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function deleteStoredPhoto(key) {
  if (!key) {
    return
  }

  if (!isIndexedDbSupported()) {
    memoryFallbackStore.delete(key)
    return
  }

  const db = await getDatabase()
  if (!db) {
    memoryFallbackStore.delete(key)
    return
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(key)

    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
    request.onerror = () => reject(request.error)
  })
}

export async function clearAllPhotos() {
  if (!isIndexedDbSupported()) {
    memoryFallbackStore.clear()
    return
  }

  const db = await getDatabase()
  if (!db) {
    memoryFallbackStore.clear()
    return
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
    request.onerror = () => reject(request.error)
  })
}

export default {
  initializeStorage,
  storeOriginalPhoto,
  getOriginalPhotoBlob,
  deleteStoredPhoto,
  clearAllPhotos
}
