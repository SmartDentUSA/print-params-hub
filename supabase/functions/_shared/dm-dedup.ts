// dm-dedup.ts — identificador único de mensagem enviada por cliente (anti-duplicidade)
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeMessage(message: string): string {
  return (message ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Reserva o envio de uma mensagem para um destinatário.
 * Retorna true se o envio deve acontecer, false se já foi enviado na janela.
 */
export async function claimDmSend(
  supabase: SupabaseClient,
  opts: {
    recipientId: string;
    message: string;
    platform?: string;
    source?: string;
    windowMinutes?: number;
  },
): Promise<boolean> {
  const recipient = String(opts.recipientId ?? '').trim();
  if (!recipient) return false;
  const hash = await sha256(normalizeMessage(opts.message));
  const { data, error } = await supabase.rpc('try_claim_social_dm', {
    _platform: opts.platform ?? 'instagram',
    _recipient_id: recipient,
    _message_hash: hash,
    _source: opts.source ?? null,
    _window_minutes: opts.windowMinutes ?? 10,
    _message_preview: opts.message ?? null,
  });
  if (error) {
    console.error(JSON.stringify({ event: 'dm_dedup.error', error: error.message }));
    return true; // fail-open: não bloqueia o envio se o guarda falhar
  }
  if (data === false) {
    console.log(JSON.stringify({ event: 'dm_dedup.skip', recipient, source: opts.source }));
  }
  return data !== false;
}
