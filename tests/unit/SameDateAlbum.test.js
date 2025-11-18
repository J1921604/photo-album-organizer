/**
 * 同じ日付で別名アルバム作成テスト (Vitest版)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  initDatabase, 
  createOrUpdateAlbum, 
  getAllAlbumDates,
  clearDatabase,
  addPhoto,
  getPhotosByAlbumId
} from '../../src/services/DatabaseService.js';
import { createManualAlbum } from '../../src/services/AlbumService.js';

describe('Same Date Multiple Albums', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('should create multiple albums with different titles on same date', async () => {
    const testDate = '2025-12-25';
    const title1 = 'クリスマス';
    const title2 = 'イベント';

    // アルバム1を作成
    const result1 = await createManualAlbum({
      dateValue: testDate,
      titleValue: title1
    });
    expect(result1.created).toBe(true);
    expect(result1.albumTitle).toBe(title1);

    // アルバム2を作成
    const result2 = await createManualAlbum({
      dateValue: testDate,
      titleValue: title2
    });
    expect(result2.created).toBe(true);
    expect(result2.albumTitle).toBe(title2);

    // DB確認
    const albums = await getAllAlbumDates();
    const sameDateAlbums = albums.filter(a => a.date === testDate);

    // 検証
    expect(sameDateAlbums.length).toBe(2);
    
    const titles = sameDateAlbums.map(a => a.title).sort();
    const expectedTitles = [title1, title2].sort();
    expect(titles).toEqual(expectedTitles);

    // タイトルが異なることを確認
    expect(sameDateAlbums[0].title).not.toBe(sameDateAlbums[1].title);
  });

  it('should not overwrite existing album when creating with different title', async () => {
    const testDate = '2025-12-25';
    const title1 = 'クリスマス';
    const title2 = 'イベント';

    // アルバム1を作成
    await createManualAlbum({
      dateValue: testDate,
      titleValue: title1
    });

    // アルバム1の状態を保存
    const album1Before = (await getAllAlbumDates()).find(a => a.date === testDate && a.title === title1);
    const album1Order = album1Before.displayOrder;

    // アルバム2を作成
    await createManualAlbum({
      dateValue: testDate,
      titleValue: title2
    });

    // アルバム1の状態を確認
    const album1After = (await getAllAlbumDates()).find(a => a.date === testDate && a.title === title1);
    
    expect(album1After).toBeDefined();
    expect(album1After.title).toBe(title1); // タイトルが変わっていない
    expect(album1After.displayOrder).toBe(album1Order); // orderが同じ
  });

  it('should prevent duplicate creation with same date and title', async () => {
    const testDate = '2025-12-25';
    const title = 'クリスマス';

    // アルバム1を作成
    const result1 = await createManualAlbum({
      dateValue: testDate,
      titleValue: title
    });
    expect(result1.created).toBe(true);

    // 同じ日付・タイトルで再作成（重複）
    const result2 = await createManualAlbum({
      dateValue: testDate,
      titleValue: title
    });
    expect(result2.created).toBe(false); // 作成されない

    // DB確認
    const albums = await getAllAlbumDates();
    const sameAlbums = albums.filter(a => a.date === testDate && a.title === title);
    
    expect(sameAlbums.length).toBe(1); // 1つだけ存在
  });

  it('should retrieve photos by album_id and not share between different albums on same date', async () => {
    const testDate = '2025-12-25';
    const title1 = 'Album A';
    const title2 = 'Album B';

    // アルバム1を作成
    const result1 = await createManualAlbum({
      dateValue: testDate,
      titleValue: title1
    });
    expect(result1.created).toBe(true);

    // アルバム2を作成
    const result2 = await createManualAlbum({
      dateValue: testDate,
      titleValue: title2
    });
    expect(result2.created).toBe(true);

    // アルバムを取得
    const albums = await getAllAlbumDates();
    const albumA = albums.find(a => a.date === testDate && a.title === title1);
    const albumB = albums.find(a => a.date === testDate && a.title === title2);

    expect(albumA).toBeDefined();
    expect(albumB).toBeDefined();
    expect(albumA.id).not.toBe(albumB.id);

    // アルバムAに写真を追加
    const photoId1 = await addPhoto({
      fileName: 'photo1.jpg',
      fileSize: 10000,
      photoDate: testDate,
      previewUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      storageKey: 'key1',
      mimeType: 'image/jpeg',
      albumId: albumA.id
    });

    // アルバムBに写真を追加
    const photoId2 = await addPhoto({
      fileName: 'photo2.jpg',
      fileSize: 10000,
      photoDate: testDate,
      previewUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      storageKey: 'key2',
      mimeType: 'image/jpeg',
      albumId: albumB.id
    });

    // album_id でそれぞれを取得
    const photosA = await getPhotosByAlbumId(albumA.id);
    const photosB = await getPhotosByAlbumId(albumB.id);

    // 検証: アルバムAには photo1 だけ、アルバムBには photo2 だけ
    expect(photosA.length).toBe(1);
    expect(photosB.length).toBe(1);
    expect(photosA[0].id).toBe(photoId1);
    expect(photosB[0].id).toBe(photoId2);
    
    // 写真が共有されていないことを確認
    expect(photosA[0].id).not.toBe(photosB[0].id);
  });
});
