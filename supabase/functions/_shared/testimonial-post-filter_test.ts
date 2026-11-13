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
