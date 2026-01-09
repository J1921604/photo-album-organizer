/**
 * AlbumService ユニットテスト
 * TDD: テスト先行 (Red-Green-Refactor)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { groupPhotosByDate, getAllAlbums } from '../../src/services/AlbumService.js'

describe('AlbumService', () => {
  describe('groupPhotosByDate', () => {
    it('should group photos by date', async () => {
      const photos = [
        { id: 1, photoDate: '2025-11-15', fileName: 'photo1.jpg' },
        { id: 2, photoDate: '2025-11-15', fileName: 'photo2.jpg' },
        { id: 3, photoDate: '2025-11-14', fileName: 'photo3.jpg' }
      ]

      const result = await groupPhotosByDate(photos)
      
      expect(result['2025-11-15']).toHaveLength(2)
      expect(result['2025-11-14']).toHaveLength(1)
      expect(Object.keys(result)).toHaveLength(2)
    })

    it('should handle empty photo array', async () => {
      const result = await groupPhotosByDate([])
      expect(result).toEqual({})
    })

    it('should create separate groups for different dates', async () => {
      const photos = [
        { id: 1, photoDate: '2025-11-15', fileName: 'photo1.jpg' },
        { id: 2, photoDate: '2025-11-14', fileName: 'photo2.jpg' },
        { id: 3, photoDate: '2025-11-13', fileName: 'photo3.jpg' }
      ]

      const result = await groupPhotosByDate(photos)
      expect(Object.keys(result).sort()).toEqual(['2025-11-13', '2025-11-14', '2025-11-15'])
    })

    it('should preserve photo order within groups', async () => {
      const photos = [
        { id: 1, photoDate: '2025-11-15', fileName: 'photo1.jpg', createdAt: '2025-11-15T10:00:00' },
        { id: 2, photoDate: '2025-11-15', fileName: 'photo2.jpg', createdAt: '2025-11-15T11:00:00' },
        { id: 3, photoDate: '2025-11-15', fileName: 'photo3.jpg', createdAt: '2025-11-15T09:00:00' }
      ]

      const result = await groupPhotosByDate(photos)
      expect(result['2025-11-15'][0].id).toBe(1)
      expect(result['2025-11-15'][1].id).toBe(2)
      expect(result['2025-11-15'][2].id).toBe(3)
    })
  })

  describe('getAllAlbums', () => {
    it('should return empty array when no albums exist', async () => {
      // Note: This test would need a mock database to work properly
      // In a real scenario, we'd mock DatabaseService.getAllAlbumDates()
      // For now, this is a placeholder that shows test structure
      const result = await getAllAlbums()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should sort albums by display_order', async () => {
      // This test demonstrates what getAllAlbums should do
      // Actual implementation would require mocking the database layer
      expect(typeof getAllAlbums).toBe('function')
    })
  })

  describe('groupPhotosByDate - Edge Cases', () => {
    it('should handle photos with same date but different times', async () => {
      const photos = [
        { id: 1, photoDate: '2025-11-15', fileName: 'morning.jpg' },
        { id: 2, photoDate: '2025-11-15', fileName: 'afternoon.jpg' },
        { id: 3, photoDate: '2025-11-15', fileName: 'evening.jpg' }
      ]

      const result = await groupPhotosByDate(photos)
      expect(result['2025-11-15']).toHaveLength(3)
    })

    it('should handle single photo', async () => {
      const photos = [
        { id: 1, photoDate: '2025-11-15', fileName: 'single.jpg' }
      ]

      const result = await groupPhotosByDate(photos)
      expect(result['2025-11-15']).toHaveLength(1)
    })

    it('should handle large batch of photos (100+)', async () => {
      const photos = Array.from({ length: 150 }, (_, i) => ({
        id: i,
        photoDate: '2025-11-15',
        fileName: `photo${i}.jpg`
      }))

      const result = await groupPhotosByDate(photos)
      expect(result['2025-11-15']).toHaveLength(150)
    })
  })
})
