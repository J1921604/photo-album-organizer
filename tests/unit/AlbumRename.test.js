/**
 * Album Rename functionality tests
 * Tests the fix for UNIQUE constraint error when renaming albums on the same date
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  initDatabase,
  clearDatabase,
  createOrUpdateAlbum,
  updateAlbumTitle,
  getAllAlbumDates
} from '../../src/services/DatabaseService.js'

describe('Album Rename with Same Date', () => {
  beforeEach(async () => {
    await initDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('should rename one album when multiple albums exist on same date', async () => {
    const testDate = '2025-11-15'

    // Create first album
    await createOrUpdateAlbum({
      albumDate: testDate,
      albumTitle: 'Album A',
      displayOrder: 0
    })

    // Create second album on same date with different name
    await createOrUpdateAlbum({
      albumDate: testDate,
      albumTitle: 'Album B',
      displayOrder: 1
    })

    // Get all albums to find the ID of Album A
    const albums = await getAllAlbumDates()
    const albumA = albums.find(a => a.date === testDate && a.title === 'Album A')
    
    expect(albumA).toBeDefined()
    expect(albumA.id).toBeDefined()

    // Rename Album A - this should NOT cause UNIQUE constraint error
    await updateAlbumTitle(albumA.id, 'Album A Renamed')

    // Verify Album A was renamed correctly
    const updated = await getAllAlbumDates()
    const renamedAlbum = updated.find(a => a.id === albumA.id)
    
    expect(renamedAlbum.title).toBe('Album A Renamed')
  })

  it('should rename both albums independently on same date without conflicts', async () => {
    const testDate = '2025-11-15'

    // Create two albums on same date
    await createOrUpdateAlbum({
      albumDate: testDate,
      albumTitle: 'Album X',
      displayOrder: 0
    })

    await createOrUpdateAlbum({
      albumDate: testDate,
      albumTitle: 'Album Y',
      displayOrder: 1
    })

    // Get IDs
    const albums = await getAllAlbumDates()
    const albumX = albums.find(a => a.date === testDate && a.title === 'Album X')
    const albumY = albums.find(a => a.date === testDate && a.title === 'Album Y')

    expect(albumX).toBeDefined()
    expect(albumY).toBeDefined()
    expect(albumX.id).toBeDefined()
    expect(albumY.id).toBeDefined()

    // Rename both albums
    await updateAlbumTitle(albumX.id, 'Album X Renamed')
    await updateAlbumTitle(albumY.id, 'Album Y Renamed')

    // Verify both were renamed correctly
    const updated = await getAllAlbumDates()
    const xResult = updated.find(a => a.id === albumX.id)
    const yResult = updated.find(a => a.id === albumY.id)

    expect(xResult.title).toBe('Album X Renamed')
    expect(yResult.title).toBe('Album Y Renamed')
  })
})
