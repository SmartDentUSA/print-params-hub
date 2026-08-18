import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SW_PATH = "/push-sw.js";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export function isIosStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return !!nav.standalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Gerencia a permissão e a assinatura de Web Push do usuário logado. */
export function usePushSubscription() {
  const supported = isPushSupported();
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : "denied",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
        if (sub) {
          await supabase.functions.invoke("push-subscribe", {
            body: { action: "ping", endpoint: sub.endpoint },
          });
        }
      } catch { /* noop */ }
    })();
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) { setError("Este navegador não suporta notificações."); return false; }
    setLoading(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { setError("Permissão de notificações negada."); return false; }

      const { data: keyRes } = await supabase.functions.invoke("push-subscribe", {
        body: { action: "public-key" },
      });
      const publicKey = (keyRes as { public_key?: string } | null)?.public_key;
      if (!publicKey) { setError("Chave de notificações indisponível."); return false; }

      const reg = await navigator.serviceWorker.register(SW_PATH);
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

      const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const { data, error: eFn } = await supabase.functions.invoke("push-subscribe", {
        body: { action: "subscribe", endpoint: raw.endpoint, keys: raw.keys },
      });
      if (eFn || !(data as { ok?: boolean } | null)?.ok) {
        setError("Não foi possível registrar as notificações.");
        return false;
      }
      setSubscribed(true);
      return true;
    } catch (e) {
      setError((e as Error)?.message ?? "Erro ao ativar notificações.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.functions.invoke("push-subscribe", {
          body: { action: "unsubscribe", endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe };
}