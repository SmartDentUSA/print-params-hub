// Espelho de supabase/functions/_shared/post-group-eligibility.ts (postTargetStatus):
// a tela mostra exatamente o mesmo motivo que o envio automático usa.
export type PostTargetStatus = 'ready' | 'missing_group' | 'other_instance' | 'group_disabled' | 'not_admin';

export type PostTargetGroup = {
  group_jid?: string | null;
  instance_name?: string | null;
  is_admin?: boolean | null;
  enabled?: boolean | null;
  ativo?: boolean | null;
} | null | undefined;

export function postTargetStatus(targetInstance: string, g: PostTargetGroup): PostTargetStatus {
  if (!g || !g.group_jid) return 'missing_group';
  if ((g.instance_name ?? '') !== targetInstance) return 'other_instance';
  if (g.enabled === false || g.ativo === false) return 'group_disabled';
  // Ser admin não é mais exigido (12/11/2026): os grupos aceitam post de qualquer
  // participante. Mantém o mesmo resultado do envio automático.
  return 'ready';
}

export function postTargetStatusLabel(status: PostTargetStatus, owner?: string | null): string {
  switch (status) {
    case 'ready': return 'Recebe os posts';
    case 'not_admin': return 'Não recebe: o número não é administrador';
    case 'group_disabled': return 'Não recebe: grupo desligado';
    case 'other_instance': return `Não recebe: grupo agora está no número ${owner || 'de outra instância'}`;
    default: return 'Não recebe: grupo não encontrado';
  }
}
