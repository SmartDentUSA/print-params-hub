import { assertEquals } from 'jsr:@std/assert@1';
import { buildButtonReplies, buttonKey, defaultReplyText, isOptOutText, matchReply, renderReply, withWhatsappOrigin } from './wa-button-replies.ts';

const buttons = [{ type: 'QUICK_REPLY', text: 'Quero saber mais' }, { type: 'QUICK_REPLY', text: 'Falar com consultor' }];
const links = { '0': 'https://s.smartdent.com.br/v7pmii', '1': 'https://s.smartdent.com.br/dh4577' };

Deno.test('textos padrão dos dois botões da BLACK26', () => {
  assertEquals(defaultReplyText('Quero saber mais'), 'Que bom, {primeiro_nome}! Veja todas as ofertas da BLACK26 aqui: {link}');
  assertEquals(defaultReplyText('Falar com consultor'), 'Perfeito, {primeiro_nome}! Fale agora com um consultor da Smart Dent pelo simulador: {link}');
});

Deno.test('rótulos futuros equivalem aos atuais', () => {
  assertEquals(buttonKey('Quero ver as ofertas'), buttonKey('Quero saber mais'));
  assertEquals(buttonKey('Falar com vendedor'), buttonKey('Falar com consultor'));
});

Deno.test('clique casa sem acento e sem maiúscula', () => {
  const r = buildButtonReplies(buttons, links, {});
  if ('error' in r) throw new Error(r.error);
  assertEquals(matchReply(r.replies, 'QUERO SABER MAIS')?.link, links['0']);
  assertEquals(matchReply(r.replies, 'falar com vendedor')?.link, links['1']);
  assertEquals(matchReply(r.replies, 'Oi, tudo bem?'), null);
});

Deno.test('botão sem link não responde; texto sem {link} recebe o link', () => {
  const r = buildButtonReplies(buttons, { '0': links['0'] }, { '0': 'Olá {primeiro_nome}' });
  if ('error' in r) throw new Error(r.error);
  assertEquals(r.replies.length, 1);
  assertEquals(r.replies[0].reply_text, 'Olá {primeiro_nome} {link}');
});

Deno.test('SAIR nunca é tratado como botão com resposta', () => {
  assertEquals(isOptOutText('SAIR'), true);
  assertEquals(isOptOutText('Quero saber mais'), false);
  const r = buildButtonReplies([{ type: 'QUICK_REPLY', text: 'Sair' }], { '0': links['0'] }, {});
  assertEquals('error' in r, true);
});

Deno.test('mensagem final com primeiro nome e origem WhatsApp no link curto', () => {
  const link = withWhatsappOrigin(links['0']);
  assertEquals(link, 'https://s.smartdent.com.br/v7pmii?o=whatsapp');
  assertEquals(renderReply(defaultReplyText('Quero saber mais'), { firstName: 'Danilo', link }),
    'Que bom, Danilo! Veja todas as ofertas da BLACK26 aqui: https://s.smartdent.com.br/v7pmii?o=whatsapp');
});
