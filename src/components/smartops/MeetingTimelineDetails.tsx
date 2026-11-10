import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

// Apresentação dos eventos do Blueprint (reunião agendada / analisada) na linha do tempo do lead.
// Somente leitura do event_data gravado pelas Edge Functions blueprint-meeting-*.

export const MEETING_EVENT_TYPES = ["reuniao_agendada", "reuniao_analisada"] as const;

const ANALYSIS_STATUS: Record<string, string> = {
  waiting_notes: "Aguardando as anotações do Gemini da reunião",
  waiting_access: "Anotações do Gemini encontradas, mas a conta do Drive conectada não tem permissão para lê-las",
  no_access: "Anotações do Gemini sem permissão de leitura — relatório não gerado",
  no_notes: "Nenhuma anotação do Gemini encontrada para esta reunião",
  failed: "Relatório gerado, mas a nota não foi gravada no CRM",
  done: "Relatório e transcrição gerados",
};

type Data = Record<string, any>;

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null);

function List({ title, items }: { title: string; items?: string[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div>
      <div className="font-medium text-foreground">{title}</div>
      <ul className="list-disc pl-4">
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

export function meetingTimelineDescription(eventType: string, data: Data): string | null {
  if (eventType === "reuniao_agendada") {
    const when = fmt(data.scheduled_start);
    const st = data.analysis?.status ? ANALYSIS_STATUS[data.analysis.status] : null;
    return [when ? `Reunião em ${when}` : null, st].filter(Boolean).join(" · ") || null;
  }
  if (eventType === "reuniao_analisada") return data.analysis?.resumo ?? null;
  return null;
}

export function MeetingTimelineDetails({ eventType, data }: { eventType: string; data: Data }) {
  if (eventType === "reuniao_agendada") {
    const st = data.analysis?.status as string | undefined;
    return (
      <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
        {data.meet_url && (
          <a href={data.meet_url} target="_blank" rel="noreferrer" className="text-primary underline">Abrir Google Meet</a>
        )}
        {st && <div>{ANALYSIS_STATUS[st] ?? st}</div>}
      </div>
    );
  }

  const a = (data.analysis ?? {}) as Data;
  const text = typeof data.notes_text === "string" ? data.notes_text : "";
  return (
    <div className="mt-1 space-y-1.5 text-[10px] text-muted-foreground">
      <div className="flex flex-wrap gap-1">
        {a.temperatura && <Badge variant="secondary" className="text-[9px] px-1 py-0">Temperatura: {a.temperatura}</Badge>}
        {a.avaliacao_vendedor?.nota_conducao != null && (
          <Badge variant="outline" className="text-[9px] px-1 py-0">Condução do vendedor: {a.avaliacao_vendedor.nota_conducao}/10</Badge>
        )}
      </div>
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-primary">
          <ChevronDown className="h-3 w-3" /> Ver relatório completo
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1 space-y-1.5">
          {a.resumo && <div><div className="font-medium text-foreground">Resumo</div>{a.resumo}</div>}
          <List title="Principais dores" items={a.dores} />
          <List title="Objeções" items={a.objecoes} />
          <List title="Próximos passos" items={(a.proximos_passos ?? []).map((p: Data) => `[${p.responsavel}] ${p.acao}`)} />
          <List title="Produtos citados" items={a.produtos_citados} />
          {a.perfil_comercial && (
            <div>
              <div className="font-medium text-foreground">Perfil comercial do lead</div>
              <div>Estilo de decisão: {a.perfil_comercial.estilo_decisao}</div>
              <div>Sensibilidade a preço: {a.perfil_comercial.sensibilidade_preco}</div>
              <div>Nível técnico: {a.perfil_comercial.nivel_tecnico}</div>
              {a.perfil_comercial.prioridades?.length > 0 && <div>Prioridades: {a.perfil_comercial.prioridades.join("; ")}</div>}
              {a.perfil_comercial.sinais_compra?.length > 0 && <div>Sinais de compra: {a.perfil_comercial.sinais_compra.join("; ")}</div>}
              {a.perfil_comercial.riscos?.length > 0 && <div>Riscos: {a.perfil_comercial.riscos.join("; ")}</div>}
            </div>
          )}
          {a.avaliacao_vendedor && (
            <div>
              <div className="font-medium text-foreground">Condução do vendedor</div>
              <div>{a.avaliacao_vendedor.resumo}</div>
              {a.avaliacao_vendedor.pontos_fortes?.length > 0 && <div>Pontos fortes: {a.avaliacao_vendedor.pontos_fortes.join("; ")}</div>}
              {a.avaliacao_vendedor.melhorias?.length > 0 && <div>A melhorar: {a.avaliacao_vendedor.melhorias.join("; ")}</div>}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
      {text && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-primary">
            <ChevronDown className="h-3 w-3" /> Ver transcrição / anotações completas
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-sans text-[10px] text-foreground">{text}</pre>
          </CollapsibleContent>
        </Collapsible>
      )}
      {data.doc_url && (
        <a href={data.doc_url} target="_blank" rel="noreferrer" className="text-primary underline">Abrir documento original no Google Docs</a>
      )}
    </div>
  );
}
