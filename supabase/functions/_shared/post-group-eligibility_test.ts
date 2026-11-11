import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { keepsOtherAdminOwner, postTargetStatus } from './post-group-eligibility.ts';

Deno.test('número não-admin não toma grupo de outro número admin', () => {
  assertEquals(keepsOtherAdminOwner({ instance_name: 'cs_principal', is_admin: true }, 'evo_cel_comercial', false), true);
});

Deno.test('número admin pode assumir o grupo', () => {
  assertEquals(keepsOtherAdminOwner({ instance_name: 'cs_principal', is_admin: true }, 'evo_cel_comercial', true), false);
});

Deno.test('grupo sem dono admin pode ser assumido', () => {
  assertEquals(keepsOtherAdminOwner({ instance_name: 'cs_principal', is_admin: false }, 'evo_cel_comercial', false), false);
  assertEquals(keepsOtherAdminOwner(null, 'evo_cel_comercial', false), false);
});

Deno.test('mesmo número sempre atualiza o próprio grupo', () => {
  assertEquals(keepsOtherAdminOwner({ instance_name: 'cs_principal', is_admin: true }, 'cs_principal', false), false);
});

const base = { group_jid: '1@g.us', instance_name: 'cs_principal', is_admin: true, enabled: true, ativo: true };

Deno.test('alvo pronto quando grupo é do mesmo número, ligado e admin', () => {
  assertEquals(postTargetStatus('cs_principal', base), 'ready');
});

Deno.test('alvo vinculado a outro número não recebe pelo número da página', () => {
  assertEquals(postTargetStatus('cs_principal', { ...base, instance_name: 'evo_cel_comercial' }), 'other_instance');
});

Deno.test('alvo com grupo desligado não recebe', () => {
  assertEquals(postTargetStatus('cs_principal', { ...base, enabled: false }), 'group_disabled');
});

Deno.test('alvo em que o número não é admin não recebe', () => {
  assertEquals(postTargetStatus('cs_principal', { ...base, is_admin: false }), 'not_admin');
});

Deno.test('alvo sem grupo não recebe', () => {
  assertEquals(postTargetStatus('cs_principal', null), 'missing_group');
});
