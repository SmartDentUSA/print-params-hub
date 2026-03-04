import { Badge } from "@/components/ui/badge";

const LEAD_VARIABLES = [
  { key: "nome", label: "Nome" },
  { key: "primeiro_nome", label: "Primeiro Nome" },
  { key: "produto_interesse", label: "Produto" },
  { key: "especialidade", label: "Especialidade" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
  { key: "area_atuacao", label: "Área" },
  { key: "proprietario_lead_crm", label: "Proprietário" },
  { key: "impressora_modelo", label: "Impressora" },
  { key: "tem_scanner", label: "Scanner" },
  { key: "piperun_id", label: "ID Pipe" },
  { key: "data_treinamento", label: "Data Treino" },
  { key: "software_cad", label: "Software CAD" },
  { key: "astron_email", label: "Email Plataforma" },
];

interface WaLeadsVariableBarProps {
  onInsert: (varKey: string) => void;
}

export function WaLeadsVariableBar({ onInsert }: WaLeadsVariableBarProps) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] text-muted-foreground">Inserir variável:</span>
      <div className="flex flex-wrap gap-1">
        {LEAD_VARIABLES.map((v) => (
          <Badge
            key={v.key}
            variant="outline"
            className="cursor-pointer text-[10px] hover:bg-primary/10 transition-colors"
            onClick={() => onInsert(v.key)}
          >
            {`{{${v.label}}}`}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** Render text with {{variables}} highlighted as badges */
export function HighlightVariables({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/({{[^}]+}})/g);
  return (
    <span className="text-[11px] break-all">
      {parts.map((part, i) => {
        const match = part.match(/^{{(.+)}}$/);
        if (match) {
          return (
            <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0 mx-0.5 font-mono">
              {match[1]}
            </Badge>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export { LEAD_VARIABLES };
