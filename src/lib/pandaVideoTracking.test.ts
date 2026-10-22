import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pandaEmbedIdentity, isPandaPlayMessage } from './pandaVideoTracking';

test('T-Marker uses its actual embed ID instead of the different Panda API ID', () => {
  assert.deepEqual(pandaEmbedIdentity('https://player-vz-004839ee-19a.tv.pandavideo.com.br/embed/?v=8d67a447-871b-49ab-9300-b46e143f787e'), { origin: 'https://player-vz-004839ee-19a.tv.pandavideo.com.br', embedId: '8d67a447-871b-49ab-9300-b46e143f787e' });
});
test('only actual play from the correct iframe is a CRM video event', () => {
  const source = {}, origin = 'https://player-vz-004839ee-19a.tv.pandavideo.com.br';
  assert.equal(isPandaPlayMessage({ origin, source, data: { message: 'panda_play' } }, origin, source), true);
  assert.equal(isPandaPlayMessage({ origin, source, data: { message: 'panda_view' } }, origin, source), false);
  assert.equal(isPandaPlayMessage({ origin: 'https://attacker.example', source, data: { message: 'panda_play' } }, origin, source), false);
  assert.equal(isPandaPlayMessage({ origin, source: {}, data: { message: 'panda_play' } }, origin, source), false);
});
test('unrelated URLs never load Panda analytics', () => {
  assert.equal(pandaEmbedIdentity('https://pandavideo.com.br.attacker.example/embed/?v=abc'), null);
  assert.equal(pandaEmbedIdentity('https://www.smartdent.com.br/photo.jpg'), null);
});