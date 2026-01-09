/**
 * Database migration integration tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import initSqlJs from 'sql.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase, getAllAlbumDates, getPhotosByDate, clearDatabase } from '../../src/services/DatabaseService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const wasmDirectory = path.resolve(__dirname, '../../node_modules/sql.js/dist')

const locateSqlWasm = file => path.join(wasmDirectory, file)

function serializeDatabaseToBase64(database) {
  const bytes = database.export()
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function decodeBase64ToUint8Array(base64) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

describe('Database migrations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates legacy schema without album_date and photo_date columns', async () => {
    const SQL = await initSqlJs({
      locateFile: locateSqlWasm
    })

    const legacyDb = new SQL.Database()
    legacyDb.run(`
      CREATE TABLE photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        data_uri TEXT NOT NULL,
        album_id INTEGER
      );
    `)

    legacyDb.run(`
      CREATE TABLE albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL
      );
    `)

    legacyDb.run(`INSERT INTO albums (date) VALUES ('2025-11-15');`)
    legacyDb.run(`
      INSERT INTO photos (file_name, file_size, data_uri, album_id)
      VALUES ('legacy.jpg', 2048, 'data:image/png;base64,ZmFrZURhdGE=', 1);
    `)

    const base64 = serializeDatabaseToBase64(legacyDb)
    localStorage.setItem('photo-album-organizer-db', base64)

    await initDatabase()

    const albums = await getAllAlbumDates()
    expect(albums).toHaveLength(1)
    expect(albums[0].date).toBe('2025-11-15')

    const photos = await getPhotosByDate('2025-11-15')
    expect(photos).toHaveLength(1)
    expect(photos[0].fileName).toBe('legacy.jpg')
    expect(photos[0].photoDate).toBe('2025-11-15')

    await clearDatabase()
  })

  it('recovers gracefully when legacy database payload is corrupted', async () => {
    const SQL = await initSqlJs({
      locateFile: locateSqlWasm
    })

    const dbInstance = new SQL.Database()
    dbInstance.run(`CREATE TABLE photos (id INTEGER PRIMARY KEY, file_name TEXT, file_size INTEGER, data_uri TEXT);`)

    const base64 = serializeDatabaseToBase64(dbInstance)
    const bytes = decodeBase64ToUint8Array(base64)
    if (bytes.length > 10) {
      bytes[5] = 0
      bytes[6] = 0
    }

    if (typeof Buffer !== 'undefined') {
      localStorage.setItem('photo-album-organizer-db', Buffer.from(bytes).toString('base64'))
    } else {
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      localStorage.setItem('photo-album-organizer-db', btoa(binary))
    }

    await initDatabase()

    const albums = await getAllAlbumDates()
    expect(Array.isArray(albums)).toBe(true)
    expect(albums.length).toBe(0)

    await clearDatabase()
  })
})
