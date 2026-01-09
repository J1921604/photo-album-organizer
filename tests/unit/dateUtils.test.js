/**
 * dateUtils ユニットテスト
 * TDD: テスト先行 (Red-Green-Refactor)
 */

import { describe, it, expect } from 'vitest'
import { formatDate, extractPhotoDate, formatDateJapanese, isSameDay } from '../../src/utils/dateUtils.js'

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('should format Date object to YYYY-MM-DD string', () => {
      const date = new Date('2025-11-15T12:00:00Z')
      const result = formatDate(date)
      expect(result).toBe('2025-11-15')
    })

    it('should pad month and day with leading zeros', () => {
      const date = new Date('2025-01-05T12:00:00Z')
      const result = formatDate(date)
      expect(result).toBe('2025-01-05')
    })

    it('should handle end of year dates', () => {
      const date = new Date('2025-12-31T23:59:59Z')
      const result = formatDate(date)
      expect(result).toBe('2025-12-31')
    })

    it('should handle beginning of year dates', () => {
      const date = new Date('2025-01-01T00:00:00Z')
      const result = formatDate(date)
      expect(result).toBe('2025-01-01')
    })
  })

  describe('extractPhotoDate', () => {
    it('should extract photo date from file lastModified', async () => {
      const mockFile = {
        lastModified: new Date('2025-11-15T10:30:00').getTime(),
        name: 'photo.jpg',
        type: 'image/jpeg',
        size: 102400
      }
      
      const result = await extractPhotoDate(mockFile)
      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBe(mockFile.lastModified)
    })

    it('should return Date object for valid file', async () => {
      const mockFile = {
        lastModified: Date.now(),
        name: 'photo.jpg',
        type: 'image/jpeg',
        size: 102400
      }
      
      const result = await extractPhotoDate(mockFile)
      expect(result).toBeInstanceOf(Date)
    })

    it('should not throw error for invalid input', async () => {
      const mockFile = {
        lastModified: null,
        name: 'photo.jpg'
      }
      
      expect(async () => {
        await extractPhotoDate(mockFile)
      }).not.toThrow()
    })
  })

  describe('formatDateJapanese', () => {
    it('should format date in Japanese format', () => {
      const date = new Date('2025-11-15T12:00:00Z') // Saturday
      const result = formatDateJapanese(date)
      expect(result).toMatch(/2025年11月15日/)
    })

    it('should include day of week in Japanese', () => {
      const date = new Date('2025-11-15T12:00:00Z')
      const result = formatDateJapanese(date)
      expect(result).toMatch(/\(土\)/)
    })
  })

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      const date1 = new Date('2025-11-15T10:00:00Z')
      const date2 = new Date('2025-11-15T20:00:00Z')
      expect(isSameDay(date1, date2)).toBe(true)
    })

    it('should return false for different days', () => {
      const date1 = new Date('2025-11-15T10:00:00Z')
      const date2 = new Date('2025-11-16T10:00:00Z')
      expect(isSameDay(date1, date2)).toBe(false)
    })

    it('should return false for different months', () => {
      const date1 = new Date('2025-11-15T10:00:00Z')
      const date2 = new Date('2025-12-15T10:00:00Z')
      expect(isSameDay(date1, date2)).toBe(false)
    })
  })
})
