import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingAttendanceMedia } from './landingAttendanceMedia';

test('a published hero image is shown as an image', () => {
  assert.deepEqual(landingAttendanceMedia({ status: 'published', hero_image_url: 'https://www.smartdent.com.br/produto.webp' }), { kind: 'image', url: 'https://www.smartdent.com.br/produto.webp' });
});
test('a published product video is shown as a playable video', () => {
  for (const extension of ['mp4', 'webm', 'mov']) {
    assert.equal(landingAttendanceMedia({ status: 'published', hero_image_url: `https://www.smartdent.com.br/produto.${extension}?v=1` })?.kind, 'video');
  }
});
test('a configured Panda product player is embedded instead of shown as an image', () => {
  assert.equal(landingAttendanceMedia({ status: 'published', hero_image_url: 'https://player-vz-example.tv.pandavideo.com.br/embed/?v=produto' })?.kind, 'embed');
});
test('missing or unpublished media does not add media to the chat', () => {
  assert.equal(landingAttendanceMedia(null), null);
  assert.equal(landingAttendanceMedia({ status: 'published', hero_image_url: '' }), null);
  assert.equal(landingAttendanceMedia({ status: 'draft', hero_image_url: 'https://www.smartdent.com.br/produto.webp' }), null);
});
test('executable media URLs are rejected', () => {
  assert.equal(landingAttendanceMedia({ status: 'published', hero_image_url: 'javascript:alert(1)' }), null);
});