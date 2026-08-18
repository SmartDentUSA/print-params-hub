import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OnlineClientRow {
  identity_key: string;
  lead_id: string | null;
  nome: string | null;
  email: string | null;
  phone: string | null;
  connections: number;
  last_seen_at: string;
  page_path: string | null;
  devices: string[] | null;
}

/** Normaliza destino (celular/e-mail) para a mesma chave usada no servidor. */
export function onlineIdentityKey(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.includes("@")) return v;
  const digits = v.replace(/\D/g, "");
  return digits ? digits.slice(-11) : v;
}

/**
 * Clientes conectados agora (por pessoa) e quantas conexões cada um mantém
 * abertas (abas/dispositivos). Fonte: heartbeat `client-presence-ping`.
 */
export function useOnlineClients(windowMinutes = 5) {
  return useQuery({
    queryKey: ["online-clients", windowMinutes],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_online_clients" as never, {
        p_window_minutes: windowMinutes,
      } as never);
      if (error) throw error;
      const rows = (data ?? []) as OnlineClientRow[];
      const byIdentity = new Map<string, OnlineClientRow>();
      rows.forEach((r) => byIdentity.set(r.identity_key, r));
      const totalConnections = rows.reduce((sum, r) => sum + (Number(r.connections) || 0), 0);
      return { rows, byIdentity, totalUsers: rows.length, totalConnections };
    },
  });
}
