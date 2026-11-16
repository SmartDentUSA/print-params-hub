/**
 * Regra de apresentação dos cards da Bio.
 *
 * Por padrão todo card publicado mostra o botão de atendimento no WhatsApp
 * ao lado do botão de acesso. Um card pode desligar esse botão
 * (`show_whatsapp = false`) para deixar apenas o link de entrada — por
 * exemplo o card da campanha que leva direto à landing page.
 */
export function bioItemShowsWhatsApp(item: { show_whatsapp?: boolean | null }): boolean {
  return item.show_whatsapp !== false;
}
