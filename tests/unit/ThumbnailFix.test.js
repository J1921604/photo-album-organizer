/**
 * Thumbnail Fix Verification Test
 * Tests that thumbnails are updated correctly for same-date albums without cross-album interference
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  initDatabase, 
  createOrUpdateAlbum, 
  getAllAlbumDates,
  clearDatabase,
  addPhoto,
  getPhotosByAlbumId,
  updateAlbumThumbnail
} from '../../src/services/DatabaseService.js';
import { createManualAlbum } from '../../src/services/AlbumService.js';
import { setAlbumThumbnail } from '../../src/services/AlbumService.js';

describe('Thumbnail Fix Verification', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('should update thumbnail for specific album_id only, not all same-date albums', async () => {
    const testDate = '2025-11-15';
    
    // Create two albums on same date
    const result1 = await createManualAlbum({ dateValue: testDate, titleValue: 'Album A' });
    expect(result1.created).toBe(true);
    
    const result2 = await createManualAlbum({ dateValue: testDate, titleValue: 'Album B' });
    expect(result2.created).toBe(true);

    // Get albums
    const albums = await getAllAlbumDates();
    const albumA = albums.find(a => a.date === testDate && a.title === 'Album A');
    const albumB = albums.find(a => a.date === testDate && a.title === 'Album B');

    expect(albumA).toBeDefined();
    expect(albumB).toBeDefined();
    expect(albumA.id).not.toBe(albumB.id);

    // Add photos to both albums
    const photoA1 = await addPhoto({
      fileName: 'photoA1.jpg',
      fileSize: 10000,
      photoDate: testDate,
      previewUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRgA1',
      storageKey: 'keyA1',
      mimeType: 'image/jpeg',
      albumId: albumA.id
    });

    const photoB1 = await addPhoto({
      fileName: 'photoB1.jpg',
      fileSize: 10000,
      photoDate: testDate,
      previewUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRgA2',
      storageKey: 'keyB1',
      mimeType: 'image/jpeg',
      albumId: albumB.id
    });

    // Initially, both have no thumbnail
    let albumsCheck = await getAllAlbumDates();
    let albumACheck = albumsCheck.find(a => a.id === albumA.id);
    let albumBCheck = albumsCheck.find(a => a.id === albumB.id);
    expect(albumACheck.thumbnailUri).toBeNull();
    expect(albumBCheck.thumbnailUri).toBeNull();

    // Set thumbnail for Album A ONLY
    const photoAData = await getPhotosByAlbumId(albumA.id);
    const thumbnailUriA = photoAData[0].previewUri;
    
    await setAlbumThumbnail(albumA.id, thumbnailUriA);

    // Verify: Only Album A has thumbnail, Album B still doesn't
    albumsCheck = await getAllAlbumDates();
    albumACheck = albumsCheck.find(a => a.id === albumA.id);
    albumBCheck = albumsCheck.find(a => a.id === albumB.id);

    expect(albumACheck.thumbnailUri).toBe(thumbnailUriA);
    expect(albumBCheck.thumbnailUri).toBeNull();  // ← CRITICAL: Must still be null!

    // Now set thumbnail for Album B
    const photoBData = await getPhotosByAlbumId(albumB.id);
    const thumbnailUriB = photoBData[0].previewUri;
    
    await setAlbumThumbnail(albumB.id, thumbnailUriB);

    // Verify: Both have their own thumbnails, they don't interfere
    albumsCheck = await getAllAlbumDates();
    albumACheck = albumsCheck.find(a => a.id === albumA.id);
    albumBCheck = albumsCheck.find(a => a.id === albumB.id);

    expect(albumACheck.thumbnailUri).toBe(thumbnailUriA);  // ← Still the same
    expect(albumBCheck.thumbnailUri).toBe(thumbnailUriB);  // ← Now has new thumbnail
    expect(albumACheck.thumbnailUri).not.toBe(albumBCheck.thumbnailUri);  // ← Different URIs
  });

  it('should isolate photo addition by album_id', async () => {
    const testDate = '2025-11-15';
    
    // Create two albums
    const result1 = await createManualAlbum({ dateValue: testDate, titleValue: 'Album X' });
    const result2 = await createManualAlbum({ dateValue: testDate, titleValue: 'Album Y' });

    const albums = await getAllAlbumDates();
    const albumX = albums.find(a => a.title === 'Album X');
    const albumY = albums.find(a => a.title === 'Album Y');

    // Add 2 photos to Album X
    await addPhoto({
      fileName: 'photo1.jpg',
      fileSize: 10000,
      photoDate: testDate,
      previewUri: 'data:image/jpeg;base64,X1',
      storageKey: 'key1',
      mimeType: 'image/jpeg',
      albumId: albumX.id
    });

    await addPhoto({
      fileName: 'photo2.jpg',
      fileSize: 10000,
      photoDate: testDate,
      previewUri: 'data:image/jpeg;base64,X2',
      storageKey: 'key2',
      mimeType: 'image/jpeg',
      albumId: albumX.id
    });

    // Add 1 photo to Album Y
    await addPhoto({
      fileName: 'photo3.jpg',
      fileSize: 10000,
      photoDate: testDate,
      previewUri: 'data:image/jpeg;base64,Y1',
      storageKey: 'key3',
      mimeType: 'image/jpeg',
      albumId: albumY.id
    });

    // Verify photo isolation by album_id
    const photosX = await getPhotosByAlbumId(albumX.id);
    const photosY = await getPhotosByAlbumId(albumY.id);

    expect(photosX.length).toBe(2);  // Only X's photos
    expect(photosY.length).toBe(1);  // Only Y's photos
    expect(photosX[0].fileName).toBe('photo1.jpg');
    expect(photosX[1].fileName).toBe('photo2.jpg');
    expect(photosY[0].fileName).toBe('photo3.jpg');
  });
});
