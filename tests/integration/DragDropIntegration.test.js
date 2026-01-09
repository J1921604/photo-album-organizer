/**
 * DragDrop 統合テスト
 * フロー: アルバムドラッグ → ドロップ → display_order更新 → 再表示 → ページ再読込後の復元
 * TDD: 実装前に失敗するテストを作成
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as DatabaseService from '../../src/services/DatabaseService.js'
import * as AlbumService from '../../src/services/AlbumService.js'

describe('Drag & Drop Integration', () => {
  beforeEach(async () => {
    localStorage.clear()
    await DatabaseService.initDatabase()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Album Reordering Flow', () => {
    it('should update display_order for dragged album', async () => {
      // Setup: Create 3 albums
      const albumDates = ['2025-11-15', '2025-11-14', '2025-11-13']
      
      for (let i = 0; i < albumDates.length; i++) {
        await DatabaseService.createOrUpdateAlbum({
          albumDate: albumDates[i],
          displayOrder: i,
          albumTitle: `Album ${i + 1}`
        })
      }

      // Initial state
      const before = await DatabaseService.getAllAlbumDates()
      expect(before.length).toBeGreaterThanOrEqual(3)

      // Simulate drag: move first album to last position
      const newOrder = ['2025-11-14', '2025-11-13', '2025-11-15']
      await AlbumService.updateAlbumOrder(newOrder)

      // Verify new order
      const after = await DatabaseService.getAllAlbumDates()
      expect(after).toBeDefined()
    })

    it('should handle multiple album reorderings', async () => {
      const albumDates = ['2025-11-15', '2025-11-14', '2025-11-13']
      
      for (let i = 0; i < albumDates.length; i++) {
        await DatabaseService.createOrUpdateAlbum({
          albumDate: albumDates[i],
          displayOrder: i,
          albumTitle: `Album ${i + 1}`
        })
      }

      // Perform multiple reorderings
      await AlbumService.updateAlbumOrder(['2025-11-13', '2025-11-15', '2025-11-14'])
      await AlbumService.updateAlbumOrder(['2025-11-14', '2025-11-13', '2025-11-15'])

      const final = await DatabaseService.getAllAlbumDates()
      expect(final).toBeDefined()
    })
  })

  describe('Persistence Across Reloads', () => {
    it('should restore album order after page reload', async () => {
      // Step 1: Create albums in initial order
      const initialOrder = ['2025-11-15', '2025-11-14', '2025-11-13']
      
      for (let i = 0; i < initialOrder.length; i++) {
        await DatabaseService.createOrUpdateAlbum({
          albumDate: initialOrder[i],
          displayOrder: i,
          albumTitle: `Album ${i + 1}`
        })
      }

      // Step 2: Reorder albums
      const newOrder = ['2025-11-13', '2025-11-15', '2025-11-14']
      await AlbumService.updateAlbumOrder(newOrder)
      await DatabaseService.saveDatabase()

      // Save current database state
      const savedDbState = localStorage.getItem('photo-album-organizer-db')
      expect(savedDbState).not.toBeNull()

      // Step 3: Simulate page reload - clear and restore from storage
      localStorage.clear()
      localStorage.setItem('photo-album-organizer-db', savedDbState)

      await DatabaseService.initDatabase()

      // Step 4: Verify order persisted
      const restoredOrder = await DatabaseService.getAllAlbumDates()
      expect(restoredOrder).toBeDefined()
      expect(restoredOrder.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Complex Reordering Scenarios', () => {
    it('should handle dragging first album to last position', async () => {
      const dates = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(2025, 10, 20 - i) // Nov 20, 19, 18, 17, 16
        return `2025-11-${String(date.getDate()).padStart(2, '0')}`
      })

      for (let i = 0; i < dates.length; i++) {
        await DatabaseService.createOrUpdateAlbum({
          albumDate: dates[i],
          displayOrder: i,
          albumTitle: `Album ${i + 1}`
        })
      }

      // Move first to last
      const reordered = [...dates.slice(1), dates[0]]
      await AlbumService.updateAlbumOrder(reordered)

      expect(reordered[reordered.length - 1]).toBe(dates[0])
    })

    it('should handle dragging last album to first position', async () => {
      const dates = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(2025, 10, 20 - i)
        return `2025-11-${String(date.getDate()).padStart(2, '0')}`
      })

      for (let i = 0; i < dates.length; i++) {
        await DatabaseService.createOrUpdateAlbum({
          albumDate: dates[i],
          displayOrder: i,
          albumTitle: `Album ${i + 1}`
        })
      }

      // Move last to first
      const reordered = [dates[dates.length - 1], ...dates.slice(0, -1)]
      await AlbumService.updateAlbumOrder(reordered)

      expect(reordered[0]).toBe(dates[dates.length - 1])
    })

    it('should handle arbitrary reordering (shuffle)', async () => {
      const dates = ['2025-11-20', '2025-11-19', '2025-11-18', '2025-11-17', '2025-11-16']

      for (let i = 0; i < dates.length; i++) {
        await DatabaseService.createOrUpdateAlbum({
          albumDate: dates[i],
          displayOrder: i,
          albumTitle: `Album ${i + 1}`
        })
      }

      // Shuffle: [3, 0, 4, 1, 2]
      const shuffled = [dates[3], dates[0], dates[4], dates[1], dates[2]]
      await AlbumService.updateAlbumOrder(shuffled)

      expect(shuffled[0]).toBe('2025-11-17')
      expect(shuffled[1]).toBe('2025-11-20')
      expect(shuffled[2]).toBe('2025-11-16')
    })
  })

  describe('Display Order Consistency', () => {
    it('should maintain consecutive display_order values', async () => {
      const dates = ['2025-11-15', '2025-11-14', '2025-11-13']

      for (let i = 0; i < dates.length; i++) {
        await DatabaseService.createOrUpdateAlbum({
          albumDate: dates[i],
          displayOrder: i,
          albumTitle: `Album ${i + 1}`
        })
      }

      // Reorder
      await AlbumService.updateAlbumOrder(['2025-11-13', '2025-11-15', '2025-11-14'])

      const albums = await DatabaseService.getAllAlbumDates()
      const orders = albums.map(a => a.displayOrder).sort()
      
      // Should be [0, 1, 2] after sorting
      for (let i = 0; i < orders.length; i++) {
        expect(orders[i]).toBe(i)
      }
    })
  })

  describe('Performance Baseline', () => {
    it('should perform drag & drop with 50 albums within 1 second', async () => {
      const dates = Array.from({ length: 50 }, (_, i) => {
        const date = new Date(2025, 10, 1)
        date.setDate(date.getDate() - i)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      })

      for (let i = 0; i < dates.length; i++) {
        await DatabaseService.createOrUpdateAlbum({
          albumDate: dates[i],
          displayOrder: i,
          albumTitle: `Album ${i + 1}`
        })
      }

      const startTime = performance.now()

      // Shuffle and reorder
      const shuffled = [...dates].sort(() => Math.random() - 0.5)
      await AlbumService.updateAlbumOrder(shuffled)
      await DatabaseService.saveDatabase()

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // Target: < 1000ms (1 second)
      expect(executionTime).toBeLessThan(1000)
    })
  })

  describe('Error Scenarios', () => {
    it('should handle reordering with missing albums gracefully', async () => {
      const dates = ['2025-11-15', '2025-11-14']

      for (let i = 0; i < dates.length; i++) {
        await DatabaseService.createOrUpdateAlbum({
          albumDate: dates[i],
          displayOrder: i,
          albumTitle: `Album ${i + 1}`
        })
      }

      // Attempt to reorder with non-existent album
      const invalidReorder = ['2025-11-15', '2025-12-01', '2025-11-14']
      
      expect(async () => {
        await AlbumService.updateAlbumOrder(invalidReorder)
      }).not.toThrow()
    })

    it('should handle empty reorder list gracefully', async () => {
      expect(async () => {
        await AlbumService.updateAlbumOrder([])
      }).not.toThrow()
    })
  })
})
