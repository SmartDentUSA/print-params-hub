// Motor do passo a passo do Copilot: uma pergunta por campo da tela, na mesma
// ordem da tela, sem IA. O roteiro de cada ferramenta implementa WizardScript.
import type { WizardOption } from "./copilotWizardParse.ts";

export type WizardInput = "text" | "textarea" | "date" | "money" | "number" | "choice" | "multi";

export type WizardQuestion = {
  /** Onde o campo fica na tela, ex.: "Dados da promoção › Nome interno". */
  where: string;
  ask: string;
  /** O que colocar no campo. */
  help?: string;
  input: WizardInput;
  options?: WizardOption[];
  /** Pré-seleção das perguntas de múltipla escolha. */
  selected?: string[];
  /** Respostas rápidas para perguntas digitadas (ex.: "Pular", "Manter ..."). */
  quick?: WizardOption[];
  placeholder?: string;
};

export type WizardAnswer<S> = { state: S; note?: string } | { error: string };

export type WizardScript<S, D> = {
  key: string;
  title: string;
  intro: string;
  init(deps: D, today: string): Promise<S>;
  question(s: S): WizardQuestion;
  answer(s: S, raw: string, deps: D): Promise<WizardAnswer<S>>;
  isReview(s: S): boolean;
  summary(s: S): string;
  payload(s: S): Record<string, unknown>;
};

export const WIZ_CONFIRM = "__confirm";
export const WIZ_CANCEL = "__cancel";
export const WIZ_SKIP = "__skip";

const normText = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Pedido digitado que deve abrir um passo a passo em vez da conversa livre. */
export function detectWizardIntent(text: string): "tabela_promocional" | null {
  const t = normText(String(text || ""));
  if (/\b(editar|edite|alterar|altere|mudar|excluir|apagar|listar|liste|quais|mostrar|mostre|ver|consultar|relatorio|quantas)\b/.test(t)) return null;
  if (/\btabelas? (promocional|promocionais|de precos?)\b/.test(t)) return "tabela_promocional";
  return null;
}
