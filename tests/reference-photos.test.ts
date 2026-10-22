import test from 'node:test';
import assert from 'node:assert/strict';
import { isHeicFile, prepareReferencePhoto, REFERENCE_PHOTO_ACCEPT } from '../src/lib/heicPreview';

test('iPhone HEIC and HEIF detection handles missing MIME, uppercase extensions and MIME-only files', () => {
  for (const [name, type] of [['IMG_1234.HEIC', ''], ['photo.HeIf', 'application/octet-stream'], ['upload', 'image/heif'], ['upload', 'image/heic'], ['upload', 'image/heic-sequence']]) {
    assert.equal(isHeicFile(new File(['fixture'], name, { type })), true, `${name}: ${type}`);
  }
  assert.ok(REFERENCE_PHOTO_ACCEPT.includes('.heic'));
  assert.ok(REFERENCE_PHOTO_ACCEPT.includes('.heif'));
});
test('ordinary reference photos retain their bytes and filename', async () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    const photo = new File(['unchanged image bytes'], 'photo', { type });
    assert.equal(isHeicFile(photo), false);
    assert.equal(await prepareReferencePhoto(photo), photo);
  }
});
