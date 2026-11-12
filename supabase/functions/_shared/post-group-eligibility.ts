// Regras compartilhadas de Post Grupos.
// wa_groups guarda UMA linha por grupo (group_jid) e o envio sai pelo número
// em wa_groups.instance_name. Por isso:
//  1) a sincronização de um número que NÃO é admin não pode tomar o grupo de
//     outro número que é admin (senão o grupo some do envio de quem o selecionou);
//  2) um alvo de Post Grupos só recebe se o grupo continua vinculado ao mesmo
//     número da instância onde foi selecionado e está ligado. Ser admin não é
//     mais exigido (12/11/2026) — ver README.md nesta pasta.

export type GroupOwnerRow = { instance_name?: string | null; is_admin?: boolean | null } | null | undefined;

export function keepsOtherAdminOwner(existing: GroupOwnerRow, syncingInstance: string, syncingIsAdmin: boolean): boolean {
  if (!existing || !existing.instance_name) return false;
  if (existing.instance_name === syncingInstance) return false;
  return existing.is_admin === true && !syncingIsAdmin;
}

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
  // is_admin não bloqueia mais o envio (12/11/2026). Medido na API do WhatsApp:
  // os grupos de público têm IsAnnounce=false, então qualquer participante
  // posta. Onde IsAnnounce=true o próprio WhatsApp recusa, e o erro aparece em
  // wa_message_queue.error_message — que é o lugar certo para isso aparecer.
  return 'ready';
}
