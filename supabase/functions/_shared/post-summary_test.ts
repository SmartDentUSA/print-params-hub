import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { composePostText, pickPostMedia, postBodyText, WA_MEDIA_CAPTION_MAX } from './post-summary.ts';

Deno.test('miniatura é usada quando não há outra mídia', () => {
  assertEquals(pickPostMedia({ thumbnail_url: 'https://cdn.x/thumb.jpg' }), { url: 'https://cdn.x/thumb.jpg', kind: 'image' });
});

Deno.test('ordem: media_urls → media_url → thumbnail_url', () => {
  const v = { media_urls: [{ url: 'https://a/1.png' }], media_url: 'https://a/2.png', thumbnail_url: 'https://a/3.jpg' };
  assertEquals(pickPostMedia(v)?.url, 'https://a/1.png');
  assertEquals(pickPostMedia({ media_url: 'https://a/2.png', thumbnail_url: 'https://a/3.jpg' })?.url, 'https://a/2.png');
});

Deno.test('miniatura .jpg de post marcado como vídeo vai como imagem', () => {
  assertEquals(pickPostMedia({ media_type: 'video', thumbnail_url: 'https://i.ytimg.com/vi/x/default.jpg' }),
    { url: 'https://i.ytimg.com/vi/x/hqdefault.jpg', kind: 'image' });
});

Deno.test('ignora URL que não é http/https', () => {
  assertEquals(pickPostMedia({ media_url: 'blob:abc', thumbnail_url: 'data:image/png;base64,xx' }), null);
});

Deno.test('legenda de mídia nunca passa de 1.024 e mantém o link', () => {
  const link = 'https://www.instagram.com/p/ABC/';
  const out = composePostText('a'.repeat(4993), link, WA_MEDIA_CAPTION_MAX);
  assertEquals(out.length, WA_MEDIA_CAPTION_MAX);
  assertEquals(out.endsWith('…\n\n' + link), true);
});

Deno.test('texto curto não é alterado', () => {
  assertEquals(composePostText('Resumo', 'https://x.y', WA_MEDIA_CAPTION_MAX), 'Resumo\n\nhttps://x.y');
});

Deno.test('usa o resumo quando existe, senão a legenda', () => {
  assertEquals(postBodyText({ resumo: 'R', caption: 'C' }), 'R');
  assertEquals(postBodyText({ resumo: '  ', caption: 'C' }), 'C');
  assertEquals(postBodyText({ caption: 'C' }), 'C');
});

Deno.test('resumo dos grupos: **negrito** vira *negrito* do WhatsApp e links/hashtags saem', async () => {
  const { cleanSummaryText } = await import('./post-summary.ts');
  assertEquals(
    cleanSummaryText('A **BLACK 26** chegou! Veja https://x.com/a #blackfriday @smartdent\n\n\n\nToque no link abaixo 👇'),
    'A *BLACK 26* chegou! Veja\n\nToque no link abaixo 👇',
  );
});
