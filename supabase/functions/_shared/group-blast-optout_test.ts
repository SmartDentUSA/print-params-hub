import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { splitGroupBlastExclusions } from './testimonial-post-filter.ts';

const optOut = [{ caption: 'Bastidores da fábrica: hoje mostramos como a resina Vitality é envasada e conferida lote a lote.' }];
const testimonial = [{ caption: 'Depoimento: a Dra. Ana saiu da imersão Chairside imprimindo coroas no mesmo dia no consultório.' }];

Deno.test('post agendado com envio aos grupos desligado fica fora do disparo', () => {
  const r = splitGroupBlastExclusions(
    [{ id: 'a', caption: optOut[0].caption + '\n\n#SmartDent #Vitality' }],
    testimonial, optOut,
  );
  assertEquals(r.optOutIds, ['a']);
  assertEquals(r.testimonialIds, []);
});

Deno.test('post com envio aos grupos ligado continua indo para os grupos', () => {
  const r = splitGroupBlastExclusions(
    [{ id: 'bf', caption: '🖤 ATENÇÃO! A BLACK 26 DA SMART DENT ESTÁ CHEGANDO! Já imaginou garantir os produtos com até 25% de desconto?' }],
    testimonial, optOut,
  );
  assertEquals(r.optOutIds, []);
  assertEquals(r.testimonialIds, []);
});

Deno.test('depoimento continua sendo barrado como antes', () => {
  const r = splitGroupBlastExclusions([{ id: 't', caption: testimonial[0].caption }], testimonial, optOut);
  assertEquals(r.testimonialIds, ['t']);
});
