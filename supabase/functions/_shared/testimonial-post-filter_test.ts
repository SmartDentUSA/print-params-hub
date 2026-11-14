import { assert, assertFalse } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { isTestimonialCaption, testimonialKeys } from './testimonial-post-filter.ts';

const scheduled = [{
  caption: '🦷 Tecnologia boa é aquela que cabe na rotina.\n\nDepois de 2 dias de imersão, a Dra. Ana contou como o fluxo digital entrou no consultório.',
  channels: [
    { platform: 'tiktok', caption: 'Ela saiu do curso imprimindo no mesmo dia. Veja o que a Dra. Ana disse sobre a imersão.' },
    { platform: 'youtube', title: 'Depoimento Imersão Chairside', caption: 'x' },
  ],
}];

Deno.test('post de depoimento no Instagram (com hashtags no fim) é reconhecido', () => {
  const keys = testimonialKeys(scheduled);
  assert(isTestimonialCaption('🦷 Tecnologia boa é aquela que cabe na rotina.\n\nDepois de 2 dias de imersão, a Dra. Ana contou como o fluxo digital entrou no consultório. #SmartDent #Odontologia', keys));
});

Deno.test('legenda própria do TikTok do depoimento é reconhecida', () => {
  const keys = testimonialKeys(scheduled);
  assert(isTestimonialCaption('Ela saiu do curso imprimindo no mesmo dia. Veja o que a Dra. Ana disse sobre a imersão. #fyp', keys));
});

Deno.test('postagem comum (Black Friday) não é bloqueada', () => {
  const keys = testimonialKeys(scheduled);
  assertFalse(isTestimonialCaption('🖤 **ATENÇÃO! A BLACK 26 DA SMART DENT ESTÁ CHEGANDO!** 🖤 Já imaginou garantir os produtos da Smart Dent com até 25% de desconto?', keys));
});

Deno.test('legenda curta demais nunca é tratada como depoimento', () => {
  const keys = testimonialKeys(scheduled);
  assertFalse(isTestimonialCaption('🦷 Tecnologia boa', keys));
});

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { buildGroupBlastText, findGroupLink } from './testimonial-post-filter.ts';

const bfRows = [{
  caption: 'BLACK FRIDAY SMART DENT: comente BLACK26 aqui nos comentários ou clique no link abaixo e garanta o desconto.',
  channels: [],
  group_link_url: 'https://s.smartdent.com.br/7nr3gv',
  created_at: '2026-11-14T10:00:00Z',
}];

Deno.test('post do Instagram recebe o link escolhido no agendamento', () => {
  assertEquals(
    findGroupLink('BLACK FRIDAY SMART DENT: comente BLACK26 aqui nos comentários ou clique no link abaixo e garanta o desconto. #blackfriday', bfRows),
    'https://s.smartdent.com.br/7nr3gv',
  );
});

Deno.test('post de outra legenda não recebe o link', () => {
  assertEquals(findGroupLink('Resina Vitality agora com novas cores para restaurações estéticas do dia a dia.', bfRows), null);
});

Deno.test('mensagem dos grupos: link escolhido logo abaixo do resumo e link do post por último', () => {
  assertEquals(
    buildGroupBlastText('Black Friday Smart Dent!', 'https://instagram.com/p/abc', 'https://s.smartdent.com.br/7nr3gv'),
    'Black Friday Smart Dent!\n\n👉 https://s.smartdent.com.br/7nr3gv\n\n📲 Ver a publicação: https://instagram.com/p/abc',
  );
});

Deno.test('sem link escolhido a mensagem continua como antes', () => {
  assertEquals(buildGroupBlastText('Resumo', 'https://instagram.com/p/abc', null), 'Resumo\n\nhttps://instagram.com/p/abc');
});

Deno.test('mensagem longa: corta só o resumo e mantém os dois links inteiros dentro de 1024', () => {
  const text = buildGroupBlastText('x'.repeat(2000), 'https://www.instagram.com/p/ABC/', 'https://s.smartdent.com.br/abc123');
  if (text.length > 1024) throw new Error(`passou do limite: ${text.length}`);
  if (!text.endsWith('👉 https://s.smartdent.com.br/abc123\n\n📲 Ver a publicação: https://www.instagram.com/p/ABC/')) throw new Error(text.slice(-120));
});
