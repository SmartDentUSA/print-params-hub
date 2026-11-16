import { assertEquals } from 'jsr:@std/assert@1';
import { planSlots, templateMeta, validateSchedule } from './plan.ts';

const now = new Date('2026-11-20T12:00:00Z');
const leads = Array.from({ length: 1000 }, (_, i) => i);

Deno.test('sem limite e sem data: um único envio imediato', () => {
  const s = planSlots(leads, { now });
  assertEquals(s.length, 1);
  assertEquals(s[0].at, null);
});

Deno.test('250 por hora: 1.000 leads viram 4 lotes de 250, uma hora entre eles, início em 2 min', () => {
  const s = planSlots(leads, { perHour: 250, now });
  assertEquals(s.map((x) => x.leads.length), [250, 250, 250, 250]);
  assertEquals(s.map((x) => x.at), ['2026-11-20T12:02:00.000Z', '2026-11-20T13:02:00.000Z', '2026-11-20T14:02:00.000Z', '2026-11-20T15:02:00.000Z']);
});

Deno.test('com data e limite: primeiro lote na data marcada', () => {
  const s = planSlots(leads.slice(0, 300), { perHour: 250, scheduledAt: '2026-11-21T11:00:00Z', now });
  assertEquals(s.map((x) => [x.at, x.leads.length]), [['2026-11-21T11:00:00.000Z', 250], ['2026-11-21T12:00:00.000Z', 50]]);
});

Deno.test('só data: tudo agendado num lote', () => {
  const s = planSlots(leads, { scheduledAt: '2026-11-21T11:00:00Z', now });
  assertEquals(s.length, 1);
  assertEquals(s[0].leads.length, 1000);
});

Deno.test('template universal: cabeçalho imagem, 4 variáveis e 2 botões', () => {
  const m = templateMeta({ name: 'smartdent_campanha_universal_img_v1', components: [
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: 'Olá {{1}}! {{2}} {{3}} {{4}}' },
    { type: 'FOOTER', text: 'Smart Dent' },
    { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Quero saber mais' }, { type: 'QUICK_REPLY', text: 'Falar com consultor' }] },
  ] });
  assertEquals(m.headerType, 'IMAGE');
  assertEquals(m.vars, 4);
  assertEquals(m.buttons.map((b) => b.text), ['Quero saber mais', 'Falar com consultor']);
});

Deno.test('agendamento no passado e limite inválido são recusados', () => {
  assertEquals(typeof validateSchedule(null, '2026-11-20T11:00:00Z', now), 'string');
  assertEquals(typeof validateSchedule(0, null, now), 'string');
  assertEquals(validateSchedule(250, '2026-11-20T15:00:00Z', now), null);
});
