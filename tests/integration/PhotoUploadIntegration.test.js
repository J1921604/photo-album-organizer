/**
 * PhotoUpload 統合テスト
 * フロー: ファイルアップロード → メタデータ抽出 → DB保存 → グループ化表示
 * TDD: 実装前に失敗するテストを作成
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as DatabaseService from '../../src/services/DatabaseService.js'
import * as AlbumService from '../../src/services/AlbumService.js'
import { extractPhotoDate, formatDate } from '../../src/utils/dateUtils.js'
import { validateImageFile } from '../../src/utils/fileValidation.js'

describe('Photo Upload Integration', () => {
  beforeEach(async () => {
    localStorage.clear()
    await DatabaseService.initDatabase()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Single Photo Upload Flow', () => {
    it('should complete full upload flow: validate → extract → save → retrieve', async () => {
      // Step 1: Create mock file
      const mockFile = {
        name: 'photo.jpg',
        type: 'image/jpeg',
        size: 51200,
        lastModified: new Date('2025-11-15T10:30:00').getTime()
      }

      // Step 2: Validate file
      const validationResult = validateImageFile(mockFile)
      expect(validationResult.valid).toBe(true)

      // Step 3: Extract photo date
      const photoDate = await extractPhotoDate(mockFile)
      const formattedDate = formatDate(photoDate)
      expect(formattedDate).toBe('2025-11-15')

      // Step 4: Save to database
      const photoId = await DatabaseService.addPhoto({
        fileName: mockFile.name,
        fileSize: mockFile.size,
        photoDate: formattedDate,
        dataUri: 'data:image/jpeg;base64,mockImageData=='
      })
      expect(photoId).toBeGreaterThan(0)

      // Step 5: Retrieve from database
      const retrievedPhotos = await DatabaseService.getPhotosByDate(formattedDate)
      expect(retrievedPhotos).toHaveLength(1)
      expect(retrievedPhotos[0].fileName).toBe('photo.jpg')
    })

    it('should reject invalid file types during validation', async () => {
      const mockFile = {
        name: 'video.mp4',
        type: 'video/mp4',
        size: 10 * 1024 * 1024,
        lastModified: Date.now()
      }

      const validationResult = validateImageFile(mockFile)
      expect(validationResult.valid).toBe(false)
      expect(validationResult.error).toBeDefined()
    })
  })

  describe('Multiple Photos Same Date', () => {
    it('should group 5 photos from same date into single album', async () => {
      const mockFiles = Array.from({ length: 5 }, (_, i) => ({
        name: `photo${i}.jpg`,
        type: 'image/jpeg',
        size: 51200,
        lastModified: new Date('2025-11-15T10:30:00').getTime() + i * 1000
      }))

      // Upload all files
      const photoIds = []
      for (const file of mockFiles) {
        const photoDate = await extractPhotoDate(file)
        const formattedDate = formatDate(photoDate)
        
        const id = await DatabaseService.addPhoto({
          fileName: file.name,
          fileSize: file.size,
          photoDate: formattedDate,
          dataUri: `data:image/jpeg;base64,data${file.name}`
        })
        photoIds.push(id)
      }

      expect(photoIds).toHaveLength(5)

      // Retrieve all photos from same date
      const retrievedPhotos = await DatabaseService.getPhotosByDate('2025-11-15')
      expect(retrievedPhotos.length).toBeGreaterThanOrEqual(5)

      // Group by date
      const groupedPhotos = await AlbumService.groupPhotosByDate(retrievedPhotos)
      expect(groupedPhotos['2025-11-15']).toHaveLength(retrievedPhotos.length)
    })
  })

  describe('Multiple Photos Different Dates', () => {
    it('should create separate albums for different dates', async () => {
      const filesWithDates = [
        { date: '2025-11-15', name: 'photo1.jpg' },
        { date: '2025-11-15', name: 'photo2.jpg' },
        { date: '2025-11-14', name: 'photo3.jpg' },
        { date: '2025-11-14', name: 'photo4.jpg' },
        { date: '2025-11-13', name: 'photo5.jpg' }
      ]

      // Upload files
      for (const file of filesWithDates) {
        await DatabaseService.addPhoto({
          fileName: file.name,
          fileSize: 51200,
          photoDate: file.date,
          dataUri: `data:image/jpeg;base64,data${file.name}`
        })
      }

      // Retrieve albums
      const albums = []
      for (const dateStr of ['2025-11-13', '2025-11-14', '2025-11-15']) {
        const photos = await DatabaseService.getPhotosByDate(dateStr)
        if (photos.length > 0) {
          albums.push({ date: dateStr, photos })
        }
      }

      expect(albums).toHaveLength(3)
      expect(albums[0].photos).toHaveLength(1) // 2025-11-13
      expect(albums[1].photos.length).toBeGreaterThanOrEqual(2) // 2025-11-14
      expect(albums[2].photos.length).toBeGreaterThanOrEqual(2) // 2025-11-15
    })
  })

  describe('Data Persistence', () => {
    it('should persist photos across database saves', async () => {
      // Add photo
      const photoId = await DatabaseService.addPhoto({
        fileName: 'persist.jpg',
        fileSize: 51200,
        photoDate: '2025-11-15',
        dataUri: 'data:image/jpeg;base64,persistData=='
      })

      await DatabaseService.saveDatabase()

      // Verify localStorage contains data
      const saved = localStorage.getItem('photo-album-organizer-db')
      expect(saved).not.toBeNull()
      expect(saved.length).toBeGreaterThan(0)

      // Re-initialize and verify
      localStorage.clear()
      localStorage.setItem('photo-album-organizer-db', saved)
      
      await DatabaseService.initDatabase()
      const retrievedPhotos = await DatabaseService.getPhotosByDate('2025-11-15')
      
      expect(retrievedPhotos.length).toBeGreaterThan(0)
      expect(retrievedPhotos[0].fileName).toBe('persist.jpg')
    })
  })

  describe('Performance Baseline', () => {
    it('should upload and group 10 photos within 1 second', async () => {
      const startTime = performance.now()

      const files = Array.from({ length: 10 }, (_, i) => ({
        name: `photo${i}.jpg`,
        type: 'image/jpeg',
        size: 51200,
        lastModified: new Date('2025-11-15T10:30:00').getTime() + i * 1000
      }))

      for (const file of files) {
        const photoDate = await extractPhotoDate(file)
        const formattedDate = formatDate(photoDate)
        
        await DatabaseService.addPhoto({
          fileName: file.name,
          fileSize: file.size,
          photoDate: formattedDate,
          dataUri: `data:image/jpeg;base64,data${file.name}`
        })
      }

      const retrievedPhotos = await DatabaseService.getPhotosByDate('2025-11-15')
      await AlbumService.groupPhotosByDate(retrievedPhotos)

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // Target: < 1000ms (1 second)
      expect(executionTime).toBeLessThan(1000)
    })
  })

  describe('Error Scenarios', () => {
    it('should handle file with invalid MIME type gracefully', async () => {
      const invalidFile = {
        name: 'document.txt',
        type: 'text/plain',
        size: 1024,
        lastModified: Date.now()
      }

      const result = validateImageFile(invalidFile)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle file size limit validation', async () => {
      const oversizedFile = {
        name: 'huge.jpg',
        type: 'image/jpeg',
        size: 150 * 1024 * 1024, // 150MB
        lastModified: Date.now()
      }

      const result = validateImageFile(oversizedFile)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('100MB')
    })
  })
})
