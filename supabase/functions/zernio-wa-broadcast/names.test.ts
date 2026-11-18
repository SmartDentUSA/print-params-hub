import { assertEquals } from 'jsr:@std/assert@1';
import { contactNameFor, groupKeyValues, namesToPatch, pickNameVarIndex } from './plan.ts';

Deno.test('a variável de primeiro nome é a preenchida pela Zernio', () => {
  assertEquals(pickNameVarIndex([{ source: 'literal', value: 'x' }, { source: 'field', value: 'primeiro_nome' }]), 1);
  assertEquals(pickNameVarIndex([{ source: 'field', value: 'cidade' }]), -1);
});

Deno.test('nomes diferentes não separam o envio: 600 leads com 392 nomes viram 1 envio', () => {
  const keys = new Set<string>();
  for (let i = 0; i < 600; i++) keys.add(JSON.stringify(groupKeyValues([`Nome${i % 392}`, 'BLACK26'], 0)));
  assertEquals(keys.size, 1);
});

Deno.test('outras variáveis diferentes continuam separando o envio', () => {
  const a = JSON.stringify(groupKeyValues(['Ana', 'SP'], 0));
  const b = JSON.stringify(groupKeyValues(['Bia', 'RJ'], 0));
  assertEquals(a === b, false);
});

Deno.test('lead sem nome recebe "colega"', () => {
  assertEquals(contactNameFor('-'), 'colega');
  assertEquals(contactNameFor(''), 'colega');
  assertEquals(contactNameFor('Danilo'), 'Danilo');
});

Deno.test('só corrige contatos com nome diferente, um por contato', () => {
  const wanted = new Map([['5519992612348', 'Danilo'], ['5516999999999', 'Ana']]);
  const r = namesToPatch([
    { contactId: 'c1', platformIdentifier: '5519992612348', contactName: '+5519992612348' },
    { contactId: 'c2', platformIdentifier: '5516999999999', contactName: 'Ana' },
    { contactId: 'c1', platformIdentifier: '5519992612348', contactName: '+5519992612348' },
    { contactId: 'c3', platformIdentifier: '5511000000000', contactName: 'X' },
  ], wanted);
  assertEquals(r, [{ contactId: 'c1', name: 'Danilo' }]);
});

import { chunk as chunkList, RECIPIENTS_PER_BROADCAST, wantedNameMap } from './plan.ts';

Deno.test('envio da Zernio cabe numa página de 200 destinatários', () => {
  assertEquals(RECIPIENTS_PER_BROADCAST, 200);
  const blocks = chunkList(Array.from({ length: 500 }, (_, i) => i), RECIPIENTS_PER_BROADCAST);
  assertEquals(blocks.map((b) => b.length), [200, 200, 100]);
});

Deno.test('nome esperado acha o telefone com e sem o 9º dígito', () => {
  const m = wantedNameMap([{ phone: '5519992612348', contactName: 'Danilo' }]);
  assertEquals(m.get('5519992612348'), 'Danilo');
  assertEquals(m.get('551992612348'), 'Danilo');
});
