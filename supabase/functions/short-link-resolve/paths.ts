/** Caminho do simulador de WhatsApp (conversa da LIA) para um formulário. */
export function whatsappSimulatorPath(formId: string, code: string): string {
  const q = new URLSearchParams({
    form: formId,
    utm_source: "short_link",
    utm_medium: "whatsapp_lia",
    utm_campaign: code,
  });
  return `/embed/dra-lia?${q.toString()}`;
}
