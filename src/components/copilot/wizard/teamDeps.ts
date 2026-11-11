// Leitura do passo a passo "Novo membro" — a mesma lista da tela Equipe,
// usada só para avisar de e-mail/celular repetido antes de salvar.
import { supabase } from "@/integrations/supabase/client";
import type { TeamDeps, TeamRef } from "@/lib/copilotTeamWizard";

export const teamDeps: TeamDeps = {
  async loadMembers() {
    const { data } = await supabase.from("team_members" as any)
      .select("nome_completo,email,whatsapp_number,evolution_phone,ativo");
    return ((data as any[]) || []).map((m): TeamRef => ({
      nome: m.nome_completo, email: m.email || "", ativo: m.ativo !== false,
      phones: [m.whatsapp_number, m.evolution_phone].filter(Boolean),
    }));
  },
};
