import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHANNEL = "client-presence";

const normalizeKey = (value?: string | null) => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.includes("@")) return v;
  const digits = v.replace(/\D/g, "");
  return digits ? digits.slice(-11) : v;
};

/**
 * Announces the current client/visitor as online while the tab is open.
 * Used on client-facing portals so the admin panel can see live presence.
 */
export function useClientPresence(identity?: string | null, meta: Record<string, unknown> = {}) {
  useEffect(() => {
    const key = normalizeKey(identity);
    if (!key) return;

    const channel = supabase.channel(CHANNEL, { config: { presence: { key } } });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ key, online_at: new Date().toISOString(), ...meta });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);
}

/** Observes who is online right now (admin side). Returns normalized keys. */
export function usePresenceWatcher() {
  const [onlineKeys, setOnlineKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase.channel(CHANNEL, { config: { presence: { key: `admin-${crypto.randomUUID()}` } } });

    const sync = () => {
      const state = channel.presenceState() as Record<string, Array<{ key?: string }>>;
      const keys = new Set<string>();
      Object.entries(state).forEach(([presenceKey, entries]) => {
        if (presenceKey.startsWith("admin-")) return;
        keys.add(presenceKey);
        entries.forEach((e) => e?.key && keys.add(String(e.key)));
      });
      setOnlineKeys(keys);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { onlineKeys, isOnline: (destino?: string | null) => {
    const key = normalizeKey(destino);
    return !!key && onlineKeys.has(key);
  } };
}

export { normalizeKey as normalizePresenceKey };
