import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMemberOption {
  id: string;
  nome_completo: string;
  email: string | null;
  role: string | null;
  whatsapp_number: string | null;
}

export function useActiveTeamMembers() {
  return useQuery({
    queryKey: ["team_members", "active"],
    queryFn: async (): Promise<TeamMemberOption[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, nome_completo, email, role, whatsapp_number")
        .eq("ativo", true)
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamMemberOption[];
    },
    staleTime: 5 * 60 * 1000,
  });
}