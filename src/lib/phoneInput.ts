/**
 * Dígitos locais (DDD + número, até 11) de um celular digitado ou colado.
 * Remove o código do país 55 quando o usuário o inclui ("+55 16 97406-5841"),
 * em vez de cortar o fim do número.
 */
export function localPhoneDigits(v: string): string {
  let d = String(v || "").replace(/\D+/g, "");
  while (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}
