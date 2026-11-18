import { assertEquals } from 'jsr:@std/assert@1';
import { failedAttemptSession, shouldRecordFailure } from './attempts.ts';

Deno.test('erros de validação e da Zernio entram no histórico', () => {
  assertEquals(shouldRecordFailure(400), true);
  assertEquals(shouldRecordFailure(500), true);
  assertEquals(shouldRecordFailure(502), true);
});

Deno.test('sem permissão, campanha já enviada e sucesso não viram tentativa com erro', () => {
  assertEquals(shouldRecordFailure(200), false);
  assertEquals(shouldRecordFailure(401), false);
  assertEquals(shouldRecordFailure(403), false);
  assertEquals(shouldRecordFailure(409), false);
});

Deno.test('tentativa com erro fica como falha do WhatsApp Oficial com o motivo e o público', () => {
  const row = failedAttemptSession({
    name: 'BlackFriday', userId: 'u1', leadIds: ['a', 'b', 'c'], accountId: 'acc', templateName: 'tpl', language: 'pt_BR',
  }, 'O disparo geraria 450 envios distintos (máx. 400).', new Date('2026-11-17T12:00:00Z'));
  assertEquals(row.status, 'failed');
  assertEquals(row.channel, 'whatsapp_oficial');
  assertEquals(row.lead_count, 3);
  assertEquals(row.sent_count, 0);
  assertEquals(row.results.error, 'O disparo geraria 450 envios distintos (máx. 400).');
});
