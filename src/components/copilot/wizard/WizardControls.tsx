import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, CheckSquare, Square } from "lucide-react";
import type { WizardQuestion } from "@/lib/copilotWizard";

type Props = {
  question: WizardQuestion;
  canGoBack: boolean;
  disabled: boolean;
  onAnswer: (value: string, label: string) => void;
  onBack: () => void;
};

/** Botões da pergunta atual do passo a passo (escolhas, marcações e respostas rápidas). */
export function WizardControls({ question, canGoBack, disabled, onAnswer, onBack }: Props) {
  const [picked, setPicked] = useState<string[]>(question.selected ?? []);
  useEffect(() => { setPicked(question.selected ?? []); }, [question]);

  const toggle = (v: string) => setPicked((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const options = question.options ?? [];

  return (
    <div className="mt-2 space-y-2">
      {question.input === "choice" && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o, i) => (
            <Button key={o.value} size="sm" variant={i === 0 ? "default" : "outline"} className="h-auto min-h-8 whitespace-normal py-1 text-left text-xs"
              disabled={disabled} onClick={() => onAnswer(o.value, o.label)} title={o.hint}>
              {o.label}
            </Button>
          ))}
        </div>
      )}
      {question.input === "multi" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const on = picked.includes(o.value);
              return (
                <Button key={o.value} size="sm" variant={on ? "secondary" : "outline"} className="h-8 gap-1 text-xs" disabled={disabled} onClick={() => toggle(o.value)} aria-pressed={on}>
                  {on ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
                  {o.label}
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={disabled} onClick={() => setPicked(options.map((o) => o.value))}>Marcar todos</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={disabled} onClick={() => setPicked([])}>Desmarcar todos</Button>
            <Button size="sm" className="h-7 gap-1 text-xs" disabled={disabled || !picked.length}
              onClick={() => onAnswer(JSON.stringify(picked), `${picked.length} selecionado(s): ${options.filter((o) => picked.includes(o.value)).map((o) => o.label).join(", ")}`)}>
              <Check className="h-3.5 w-3.5" /> Concluir ({picked.length})
            </Button>
          </div>
        </>
      )}
      {question.input !== "choice" && question.input !== "multi" && (
        <p className="text-xs text-muted-foreground">Digite a resposta na caixa abaixo{question.placeholder ? ` (${question.placeholder})` : ""}{question.quick?.length ? " ou clique numa opção:" : "."}</p>
      )}
      {!!question.quick?.length && (
        <div className="flex flex-wrap gap-1.5">
          {question.quick.map((o) => (
            <Button key={o.value + o.label} size="sm" variant="outline" className="h-8 bg-background text-xs" disabled={disabled} onClick={() => onAnswer(o.value, o.label)}>
              {o.label}
            </Button>
          ))}
        </div>
      )}
      {canGoBack && (
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" disabled={disabled} onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
      )}
    </div>
  );
}
