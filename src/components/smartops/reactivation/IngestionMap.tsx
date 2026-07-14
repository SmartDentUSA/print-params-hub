import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const sources = [
  { name: "Meta Lead Ads", edge: "smart-ops-ingest-lead", tables: ["meta_lead_event_buffer", "lia_attendances"], guards: ["email_required", "test_domain_filter", "commercial_intent"] },
  { name: "Formulário SDR", edge: "smart-ops-ingest-lead", tables: ["smartops_form_field_responses", "lia_attendances", "smartops_forms"], guards: ["email_required", "commercial_intent"] },
  { name: "SellFlux Webhook", edge: "smart-ops-ingest-lead", tables: ["lia_attendances"], guards: ["email_required"] },
  { name: "E-commerce (Loja Integrada)", edge: "loja-integrada-webhook", tables: ["loja_integrada_orders", "loja_integrada_order_items", "lia_attendances"], guards: ["append_only", "real_timestamp"] },
  { name: "PipeRun Webhook", edge: "smart-ops-piperun-webhook", tables: ["piperun_webhook_events", "deals", "lia_attendances"], guards: ["golden_rule"] },
  { name: "Import CSV", edge: "import-leads-csv", tables: ["lia_attendances", "dh_leads_staging"], guards: ["enrich_only"] },
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