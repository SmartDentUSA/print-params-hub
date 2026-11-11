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
