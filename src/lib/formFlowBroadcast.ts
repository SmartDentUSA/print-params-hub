/**
 * Notifica janelas/abas abertas com a pré-visualização do fluxo
 * (`SmartOpsFormFlowPreview`) que os campos do formulário foram alterados.
 * Chamada após qualquer save no editor — fail-safe (no-op se navegador não suporta).
 */
export function broadcastFormFieldsChanged(formId: string) {
  try {
    const bc = new BroadcastChannel(`smartops-form-${formId}`);
    bc.postMessage({ type: "fields-updated", at: Date.now() });
    bc.close();
  } catch {
    // sem suporte — o polling do preview cobre
  }
}