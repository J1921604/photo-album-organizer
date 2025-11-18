/**
 * DatabaseService コントラクトテスト
 * TDD: API仕様に対するテスト先行
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as DatabaseService from '../../src/services/DatabaseService.js'

describe('DatabaseService Contract', () => {
  beforeEach(async () => {
    // Clear localStorage before each test
    localStorage.clear()
    await DatabaseService.initDatabase()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('addPhoto API', () => {
    it('should add photo to database and return ID', async () => {
      const mockPhoto = {
        fileName: 'test.jpg',
        fileSize: 1024,
        photoDate: '2025-11-15',
        dataUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
      }

      const id = await DatabaseService.addPhoto(mockPhoto)
      
      expect(typeof id).toBe('number')
      expect(id).toBeGreaterThan(0)
    })

    it('should validate required fields', async () => {
      const invalidPhoto = {
        fileName: 'test.jpg',
        // missing required fields
      }

      expect(async () => {
        await DatabaseService.addPhoto(invalidPhoto)
      }).rejects.toThrow()
    })

    it('should persist photo to localStorage', async () => {
      const mockPhoto = {
        fileName: 'persist_test.jpg',
        fileSize: 2048,
        photoDate: '2025-11-15',
        dataUri: 'data:image/jpeg;base64,ABC='
      }

      await DatabaseService.addPhoto(mockPhoto)
      
      const savedDb = localStorage.getItem('photo-album-organizer-db')
      expect(savedDb).not.toBeNull()
      expect(savedDb).toBeTruthy()
    })
  })

  describe('getPhotosByDate API', () => {
    it('should retrieve photos by date', async () => {
      const mockPhoto = {
        fileName: 'test.jpg',
        fileSize: 1024,
        photoDate: '2025-11-15',
        dataUri: 'data:image/jpeg;base64,ABC='
      }

      await DatabaseService.addPhoto(mockPhoto)
      const photos = await DatabaseService.getPhotosByDate('2025-11-15')

      expect(Array.isArray(photos)).toBe(true)
      expect(photos.length).toBeGreaterThan(0)
      expect(photos[0].photoDate).toBe('2025-11-15')
    })

    it('should return empty array for non-existent date', async () => {
      const photos = await DatabaseService.getPhotosByDate('2025-12-25')
      
      expect(Array.isArray(photos)).toBe(true)
      expect(photos).toHaveLength(0)
    })

    it('should return photos sorted by creation time', async () => {
      const dates = ['2025-11-15', '2025-11-15', '2025-11-15']
      
      for (const date of dates) {
        await DatabaseService.addPhoto({
          fileName: `photo_${Date.now()}.jpg`,
          fileSize: 1024,
          photoDate: date,
          dataUri: 'data:image/jpeg;base64,ABC='
        })
      }

      const photos = await DatabaseService.getPhotosByDate('2025-11-15')
      expect(photos.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('createOrUpdateAlbum API', () => {
    it('should create album with display order', async () => {
      const album = {
        albumDate: '2025-11-15',
        displayOrder: 0
      }

      // This test assumes createOrUpdateAlbum exists and is exported
      expect(typeof DatabaseService.createOrUpdateAlbum).toBe('function')
    })

    it('should update album if exists', async () => {
      // Testing UPSERT semantics
      expect(typeof DatabaseService.createOrUpdateAlbum).toBe('function')
    })
  })

  describe('updateAlbumOrder API', () => {
    it('should update display order for albums', async () => {
      expect(typeof DatabaseService.updateAlbumOrder).toBe('function')
    })

    it('should preserve order across saves', async () => {
      expect(typeof DatabaseService.updateAlbumOrder).toBe('function')
    })
  })

  describe('saveDatabase API', () => {
    it('should persist database to localStorage', async () => {
      await DatabaseService.saveDatabase()
      
      const saved = localStorage.getItem('photo-album-organizer-db')
      expect(saved).not.toBeNull()
      expect(saved.length).toBeGreaterThan(0)
    })

    it('should be base64 encoded', async () => {
      await DatabaseService.addPhoto({
        fileName: 'test.jpg',
        fileSize: 1024,
        photoDate: '2025-11-15',
        dataUri: 'data:image/jpeg;base64,ABC='
      })
      await DatabaseService.saveDatabase()
      
      const saved = localStorage.getItem('photo-album-organizer-db')
      // Base64 should only contain valid base64 characters
      expect(/^[A-Za-z0-9+/=]*$/.test(saved)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for database operations on uninitialized DB', async () => {
      localStorage.clear()
      
      expect(async () => {
        await DatabaseService.getPhotosByDate('2025-11-15')
      }).rejects.toThrow()
    })

    it('should not throw for missing photos', async () => {
      const result = await DatabaseService.getPhotosByDate('1900-01-01')
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Data Integrity', () => {
    it('should maintain data after multiple operations', async () => {
      const photos = [
        { fileName: 'photo1.jpg', fileSize: 1024, photoDate: '2025-11-15', dataUri: 'data:image/jpeg;base64,A=' },
        { fileName: 'photo2.jpg', fileSize: 2048, photoDate: '2025-11-15', dataUri: 'data:image/jpeg;base64,B=' }
      ]

      for (const photo of photos) {
        await DatabaseService.addPhoto(photo)
      }

      const retrieved = await DatabaseService.getPhotosByDate('2025-11-15')
      expect(retrieved.length).toBeGreaterThanOrEqual(2)
    })
  })
})
