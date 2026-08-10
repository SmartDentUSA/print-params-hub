import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamPhoneMatch {
  id: string;
  nome_completo: string;
  role: string | null;
  ativo: boolean;
  matched_field: string;
}

const FIELDS = [
  'whatsapp_number',
  'evolution_phone',
  'notification_phone',
  'evolution_lid',
] as const;

const digits = (v?: string | null) => (v ?? '').replace(/\D/g, '');
const key8 = (v?: string | null) => {
  const d = digits(v);
  return d.length >= 8 ? d.slice(-8) : '';
};

function normName(v?: string | null) {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Diretório de telefones da equipe — usado só para IDENTIFICAR nas caixas de
 * entrada quais números/contatos pertencem a membros da equipe (mensagem interna).
 * Não altera nenhum dado: leitura pura de team_members.
 */
export function useTeamPhoneDirectory() {
  const query = useQuery({
    queryKey: ['team-phone-directory'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, nome_completo, role, ativo, whatsapp_number, evolution_phone, notification_phone, evolution_lid');
      if (error) throw error;

      const byPhone = new Map<string, TeamPhoneMatch>();
      const byName = new Map<string, TeamPhoneMatch>();
      for (const m of (data ?? []) as any[]) {
        const base = {
          id: m.id as string,
          nome_completo: (m.nome_completo ?? '') as string,
          role: (m.role ?? null) as string | null,
          ativo: Boolean(m.ativo),
        };
        for (const f of FIELDS) {
          const k = key8(m[f]);
          if (!k) continue;
          const existing = byPhone.get(k);
          // ativo tem prioridade; campos na ordem de confiança acima
          if (!existing || (!existing.ativo && base.ativo)) {
            byPhone.set(k, { ...base, matched_field: f });
          }
        }
        const n = normName(m.nome_completo);
        if (n.split(' ').length >= 2 && !byName.has(n)) {
          byName.set(n, { ...base, matched_field: 'nome' });
        }
      }
      return { byPhone, byName };
    },
  });

  const matchPhone = (phone?: string | null): TeamPhoneMatch | null => {
    const k = key8(phone);
    if (!k) return null;
    return query.data?.byPhone.get(k) ?? null;
  };

  const matchName = (name?: string | null): TeamPhoneMatch | null => {
    const n = normName(name);
    if (!n || n.split(' ').length < 2) return null;
    return query.data?.byName.get(n) ?? null;
  };

  /** Tenta telefone (inclui dígitos dentro de textos/handles) e, em último caso, nome completo. */
  const matchAny = (...values: (string | null | undefined)[]): TeamPhoneMatch | null => {
    for (const v of values) {
      const m = matchPhone(v);
      if (m) return m;
    }
    for (const v of values) {
      const m = matchName(v);
      if (m) return m;
    }
    return null;
  };

  return { ...query, matchPhone, matchName, matchAny };
}
