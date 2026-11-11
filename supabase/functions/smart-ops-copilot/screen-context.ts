// Contexto de tela vindo do menu em botões do Copilot.
// O texto do cliente é só orientação (rótulos/descrição), limpo e limitado;
// nenhuma permissão nova nasce daqui — as ferramentas continuam checando tudo.
import { GUIDED_SEQUENCES } from "./guided.ts";

const clean = (v: unknown, max: number) =>
  String(v ?? "").replace(/[`\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export type ScreenMenu = {
  group?: string; section?: string; subtab?: string; hint?: string; guided?: string;
};

export function buildScreenContextMessage(menu: ScreenMenu | null | undefined): string | null {
  if (!menu || typeof menu !== "object") return null;
  const section = clean(menu.section, 60);
  if (!section) return null;
  const group = clean(menu.group, 40);
  const subtab = clean(menu.subtab, 60);
  const hint = clean(menu.hint, 200);
  const guided = typeof menu.guided === "string" && Object.prototype.hasOwnProperty.call(GUIDED_SEQUENCES, menu.guided)
    ? menu.guided : null;
  const path = [group, section, subtab && subtab !== section ? subtab : ""].filter(Boolean).join(" › ");
  const lines = [
    "## CONTEXTO DE TELA (menu do Copilot)",
    `O usuário escolheu no menu: ${path}.`,
    hint ? `Sobre esta tela: ${hint}` : "",
    guided
      ? `Fluxo guiado disponível: chame guided_creation_menu com tipo "${guided}" e siga os passos na ordem, um bloco por vez.`
      : "Sem fluxo guiado próprio. Pergunte o que o usuário quer fazer nesta tela (com opções em copilot-options). Use apenas ferramentas que existem; se não houver ferramenta que grave isto, diga com clareza: \"Ainda não consigo gravar isto por aqui — use a tela " + (subtab || section) + "\" e, se ajudar, ofereça consultar ou explicar os dados.",
    "Mantenha a conversa dentro desta tela até o usuário escolher outra área no menu.",
  ];
  return lines.filter(Boolean).join("\n");
}
