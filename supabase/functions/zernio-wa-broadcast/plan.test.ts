import { assertEquals } from 'jsr:@std/assert@1';
import { MAX_TEST_PHONES, broadcastKeepsHeaderMedia, fillTokens, phoneVariants, checkHeaderImage, planSlots, pushIntoWindow, resolveButtons, templateMeta, validateDailyAndCost, validateSchedule } from './plan.ts';

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

Deno.test('100 por hora com 250 leads: 3 lotes agendados de hora em hora', () => {
  const s = planSlots(leads.slice(0, 250), { perHour: 100, scheduledAt: '2026-11-20T13:00:00Z', now }); // 10:00 em SP
  assertEquals(s.map((x) => [x.at, x.leads.length]), [
    ['2026-11-20T13:00:00.000Z', 100], ['2026-11-20T14:00:00.000Z', 100], ['2026-11-20T15:00:00.000Z', 50]]);
});

Deno.test('janela 07:30–19:00: agendamento às 22:00 de SP vai para 07:30 do dia seguinte', () => {
  assertEquals(pushIntoWindow(new Date('2026-11-21T01:00:00Z'), '07:30', '19:00').toISOString(), '2026-11-21T10:30:00.000Z');
  assertEquals(pushIntoWindow(new Date('2026-11-20T08:00:00Z'), '07:30', '19:00').toISOString(), '2026-11-20T10:30:00.000Z'); // 05:00 SP
  assertEquals(pushIntoWindow(new Date('2026-11-20T15:00:00Z'), '07:30', '19:00').toISOString(), '2026-11-20T15:00:00.000Z');
});

Deno.test('lote que passaria das 19:00 de SP continua às 07:30 do dia seguinte', () => {
  const s = planSlots(leads.slice(0, 300), { perHour: 100, scheduledAt: '2026-11-20T20:30:00Z', now, windowStart: '07:30', windowEnd: '19:00' }); // 17:30 SP
  assertEquals(s.map((x) => x.at), ['2026-11-20T20:30:00.000Z', '2026-11-20T21:30:00.000Z', '2026-11-21T10:30:00.000Z']);
});

Deno.test('imagem: só JPG/PNG até 5 MB', () => {
  assertEquals(checkHeaderImage(200, 'image/png', 1_000_000), null);
  assertEquals(typeof checkHeaderImage(200, 'image/webp', 1_000), 'string');
  assertEquals(typeof checkHeaderImage(200, 'image/jpeg', 6 * 1024 * 1024), 'string');
  assertEquals(typeof checkHeaderImage(404, 'image/jpeg', 1_000), 'string');
});

Deno.test('botões: resposta rápida só guarda o link; URL com variável envia o sufixo; URL fixa ignora', () => {
  const r = resolveButtons([
    { type: 'QUICK_REPLY', text: 'Quero saber mais' },
    { type: 'URL', text: 'Ver oferta', url: 'https://s.smartdent.com.br/{{1}}', urlHasVariable: true },
    { type: 'URL', text: 'Site', url: 'https://smartdent.com.br', urlHasVariable: false },
  ], { '0': 'https://s.smartdent.com.br/v7pmii', '1': 'https://s.smartdent.com.br/abc?o=whatsapp', '2': 'https://x.com' });
  if ('error' in r) throw new Error(r.error);
  assertEquals(r.stored, { '0': 'https://s.smartdent.com.br/v7pmii', '1': 'https://s.smartdent.com.br/abc?o=whatsapp' });
  assertEquals(r.components, [{ type: 'button', sub_type: 'url', index: '1', parameters: [{ type: 'text', text: 'abc?o=whatsapp' }] }]);
  assertEquals(r.warnings.length, 1);
  const bad = resolveButtons([{ type: 'URL', text: 'Ver oferta', url: 'https://s.smartdent.com.br/{{1}}', urlHasVariable: true }], { '0': 'https://outro.com/x' });
  assertEquals('error' in bad, true);
});

Deno.test('template devolve rodapé e tipo dos botões', () => {
  const m = templateMeta({ components: [
    { type: 'FOOTER', text: 'Smart Dent • Responda SAIR para não receber mais' },
    { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Ver', url: 'https://a.com/{{1}}' }] },
  ] });
  assertEquals(m.footer, 'Smart Dent • Responda SAIR para não receber mais');
  assertEquals(m.buttons, [{ type: 'URL', text: 'Ver', url: 'https://a.com/{{1}}', urlHasVariable: true }]);
});

Deno.test('só aceita o broadcast se a Zernio guardou a imagem da campanha', () => {
  assertEquals(broadcastKeepsHeaderMedia({ template: { headerMedia: { link: 'https://a.com/i.jpg' } } }, 'https://a.com/i.jpg'), true);
  assertEquals(broadcastKeepsHeaderMedia({ broadcast: { template: { name: 'x' } } }, 'https://a.com/i.jpg'), false);
});

Deno.test('teste aceita no máximo 5 números digitados', () => {
  assertEquals(MAX_TEST_PHONES, 5);
});

Deno.test('phoneVariants acha o celular com e sem o 9º dígito', () => {
  assertEquals(phoneVariants('5516997501531'), ['5516997501531', '551697501531']);
  assertEquals(phoneVariants('551697501531'), ['551697501531', '5516997501531']);
  assertEquals(phoneVariants('551634194735'), ['551634194735']);
});

Deno.test('máximo 250 por dia: 600 leads às 09:00 viram 3 lotes, um a cada 24 h', () => {
  const s = planSlots(leads.slice(0, 600), { perDay: 250, scheduledAt: '2026-11-20T12:00:00Z', now: new Date('2026-11-20T10:00:00Z') });
  assertEquals(s.map((x) => [x.at, x.leads.length]), [
    ['2026-11-20T12:00:00.000Z', 250], ['2026-11-21T12:00:00.000Z', 250], ['2026-11-22T12:00:00.000Z', 100]]);
});

Deno.test('250 por dia e 100 por hora: 100, 100, 50 no dia; o resto só 24 h depois do 1º lote', () => {
  const s = planSlots(leads.slice(0, 400), { perHour: 100, perDay: 250, scheduledAt: '2026-11-20T13:00:00Z', now });
  assertEquals(s.map((x) => [x.at, x.leads.length]), [
    ['2026-11-20T13:00:00.000Z', 100], ['2026-11-20T14:00:00.000Z', 100], ['2026-11-20T15:00:00.000Z', 50],
    ['2026-11-21T13:00:00.000Z', 100], ['2026-11-21T14:00:00.000Z', 50]]);
});

Deno.test('público dentro do limite diário e sem data continua saindo agora', () => {
  const s = planSlots(leads.slice(0, 200), { perDay: 250, now });
  assertEquals(s, [{ at: null, leads: leads.slice(0, 200) }]);
});

Deno.test('lote diário iniciado às 18:00 de SP repete às 18:00 do dia seguinte', () => {
  // começa 18:00 SP; 24 h depois = 18:00 do dia seguinte (dentro da janela)
  const s = planSlots(leads.slice(0, 300), { perDay: 250, scheduledAt: '2026-11-20T21:00:00Z', now });
  assertEquals(s.map((x) => x.at), ['2026-11-20T21:00:00.000Z', '2026-11-21T21:00:00.000Z']);
});

Deno.test('texto livre com campos do sistema', () => {
  const vals: Record<string, string> = { primeiro_nome: '', empresa: 'Clínica Sorriso', cidade: '' };
  const get = (k: string) => (k in vals ? vals[k] : null);
  assertEquals(fillTokens('Oi {primeiro_nome}, oferta para {empresa}!', get), 'Oi colega, oferta para Clínica Sorriso!');
  assertEquals(fillTokens('Condição em {cidade} hoje', get), 'Condição em hoje');
  assertEquals(fillTokens('Use {cupom_x} agora', get), 'Use {cupom_x} agora');
});

Deno.test('limite diário e custo inválidos são recusados', () => {
  assertEquals(typeof validateDailyAndCost(0, null), 'string');
  assertEquals(typeof validateDailyAndCost(null, -1), 'string');
  assertEquals(validateDailyAndCost(250, 0.35), null);
});
