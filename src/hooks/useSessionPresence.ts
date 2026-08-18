import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientPresence } from "@/hooks/useClientPresence";

const PING_MS = 60_000;

/**
 * Mantém o cliente logado marcado como ONLINE em qualquer página do sistema:
 * - presença em tempo real (Supabase Realtime)
 * - heartbeat de 1 min atualizando last_seen_at
 */
export function useSessionPresence() {
  const [identity, setIdentity] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const resolve = (session: { user?: { email?: string | null; user_metadata?: Record<string, unknown> } } | null) => {
      const user = session?.user;
      if (!user) { setIdentity(null); setEmail(null); return; }
      const phone = String((user.user_metadata as { phone?: string } | undefined)?.phone ?? "");
      setIdentity(phone || user.email || null);
      setEmail(user.email ?? null);
    };
    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => resolve(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useClientPresence(identity, { source: "portal" });

  useEffect(() => {
    if (!identity) return;
    const ping = () => {
      if (document.visibilityState === "hidden") return;
      supabase.functions.invoke("client-presence-ping", {
        body: { phone: /\d/.test(identity) && !identity.includes("@") ? identity : undefined, email },
      }).catch(() => undefined);
    };
    ping();
    const timer = window.setInterval(ping, PING_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [identity, email]);
}

export function SessionPresence() {
  useSessionPresence();
  return null;
}
