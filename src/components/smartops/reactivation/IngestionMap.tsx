import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const sources = [
  {
    name: "Meta Lead Ads",
    purpose:
      "Recebe leads vindos de anúncios do Meta (Facebook/Instagram). Deduplica pelo Meta lead_id, filtra domínios de teste, exige e-mail e valida commercial intent antes de criar/atualizar lead e Deal em VENDAS.",
    edge: "smart-ops-ingest-lead",
    tables: ["meta_lead_event_buffer", "lia_attendances"],
    guards: ["email_required", "test_domain_filter", "commercial_intent"],
  },
  {
    name: "Formulário SDR",
    purpose:
      "Ingere respostas dos formulários públicos SmartOps (landing pages, quizzes). Mapeia campos dinâmicos para colunas canônicas de lia_attendances e dispara Deal em VENDAS quando o formulário está whitelistado.",
    edge: "smart-ops-ingest-lead",
    tables: ["smartops_form_field_responses", "lia_attendances", "smartops_forms"],
    guards: ["email_required", "commercial_intent"],
  },
  {
    name: "SellFlux Webhook",
    purpose:
      "Sincroniza compradores/assinantes vindos do SellFlux (Astron, PIX, planos). Salva custom fields no lead e cria linha do tempo, sem abrir Deal comercial automaticamente (protege CS).",
    edge: "smart-ops-ingest-lead",
    tables: ["lia_attendances"],
    guards: ["email_required"],
  },
  {
    name: "E-commerce (Loja Integrada)",
    purpose:
      "Puxa pedidos da Loja Integrada de forma incremental. Grava pedidos e itens com timestamp real da API (nunca now()), atualiza LTV e histórico de produtos do lead. Não sobrescreve dados de origem.",
    edge: "loja-integrada-webhook",
    tables: ["loja_integrada_orders", "loja_integrada_order_items", "lia_attendances"],
    guards: ["append_only", "real_timestamp"],
  },
  {
    name: "PipeRun Webhook",
    purpose:
      "Recebe eventos do PipeRun (mudança de etapa, ganho, perda) e reflete no CDP: atualiza deal, stage history e real_status do lead. Respeita Golden Rule (não recria deal existente).",
    edge: "smart-ops-piperun-webhook",
    tables: ["piperun_webhook_events", "deals", "lia_attendances"],
    guards: ["golden_rule"],
  },
  {
    name: "Import CSV",
    purpose:
      "Importa planilhas para enriquecimento em massa. Nunca cria leads novos — apenas complementa campos vazios de leads existentes (enrich-only), casando por e-mail ou telefone normalizado.",
    edge: "import-leads-csv",
    tables: ["lia_attendances", "dh_leads_staging"],
    guards: ["enrich_only"],
  },
];

export function IngestionMap() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Mapa de Ingestão de Leads</h3>
        <p className="text-sm text-muted-foreground">
          Todas as fontes que hoje entram em <code>lia_attendances</code>. Cada fonte mostra a edge function, tabelas envolvidas e guards aplicados.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sources.map((s) => (
          <Card key={s.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{s.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground text-xs leading-relaxed">{s.purpose}</p>
            <div><span className="text-muted-foreground">Edge:</span> <code className="text-xs">{s.edge}</code></div>
              <div>
                <span className="text-muted-foreground text-xs">Tabelas: </span>
                {s.tables.map((t) => <Badge key={t} variant="outline" className="mr-1 text-xs">{t}</Badge>)}
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Guards: </span>
                {s.guards.map((g) => <Badge key={g} variant="secondary" className="mr-1 text-xs">{g}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Política de merge por campo</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Editor da política <code>PROTECTED</code> / <code>ALWAYS_UPDATE</code> / <code>MERGE_ARRAYS</code> / <code>MERGE_JSONB</code> / <code>ENRICHMENT_ONLY</code> por campo será adicionado quando o motor de fluxos assumir o <code>ingest_lead</code>. Hoje o comportamento vive em <code>lead-enrichment.ts</code>.
        </CardContent>
      </Card>
    </div>
  );
}