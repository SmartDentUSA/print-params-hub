import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildTeaserMessage, fallbackTeaser, pickCoverUrl } from './teaser.ts';

Deno.test('resumo de reserva nunca manda a legenda inteira', () => {
  const longa = 'Frase inicial sobre impressão 3D. '.repeat(40) + '#odontologia #smartdent';
  const t = fallbackTeaser(longa);
  assert(t.length <= 221, `tamanho ${t.length}`);
  assert(!t.includes('#odontologia'));
});

Deno.test('mensagem termina com o link clicável da publicação', () => {
  const msg = buildTeaserMessage('Resumo curto', 'https://www.instagram.com/reel/ABC/');
  assert(msg.endsWith('https://www.instagram.com/reel/ABC/'));
  assert(msg.startsWith('Resumo curto'));
});

Deno.test('capa usa a miniatura e ignora o vídeo .mp4 do reel', () => {
  const cover = pickCoverUrl({
    thumbnail_url: 'https://cdn.example.com/capa.jpg?x=1',
    media_url: 'https://cdn.example.com/video.mp4?x=1',
  });
  assertEquals(cover, 'https://cdn.example.com/capa.jpg?x=1');
  assertEquals(pickCoverUrl({ media_url: 'https://cdn.example.com/video.mp4' }), null);
});
