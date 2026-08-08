// _shared/wa-automation-settings.ts
// Configuração (liga/desliga, instância e texto) das automações de WhatsApp
// que não tinham UI. Editável em Automações → "Automações sem UI".
// deno-lint-ignore-file no-explicit-any

export interface WaAutomationSetting {
  slug: string;
  ativo: boolean;
  wa_instance_name: string | null;
  message_template: string | null;
}

const cache = new Map<string, WaAutomationSetting>();

export async function getWaAutomationSetting(
  supabase: any,
  slug: string,
): Promise<WaAutomationSetting> {
  const cached = cache.get(slug);
  if (cached) return cached;
  // fail-open: se a leitura falhar, a automação continua ligada
  let setting: WaAutomationSetting = { slug, ativo: true, wa_instance_name: null, message_template: null };
  try {
    const { data } = await supabase
      .from("wa_automation_settings")
      .select("ativo, wa_instance_name, message_template")
      .eq("slug", slug)
      .maybeSingle();
    if (data) {
      setting = {
        slug,
        ativo: (data as any).ativo !== false,
        wa_instance_name: ((data as any).wa_instance_name as string | null)?.trim() || null,
        message_template: ((data as any).message_template as string | null)?.trim() || null,
      };
    }
  } catch (e) {
    console.warn(`[wa-automation-settings] leitura falhou (${slug}):`, (e as Error).message);
  }
  cache.set(slug, setting);
  return setting;
}

export function renderWaTemplate(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v == null || v === "" ? "—" : String(v);
  });
}
