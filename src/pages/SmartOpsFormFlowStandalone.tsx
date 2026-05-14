import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SmartOpsFormFlowPreview } from "@/components/SmartOpsFormFlowPreview";
import { Badge } from "@/components/ui/badge";

export default function SmartOpsFormFlowStandalone() {
  const { formId } = useParams<{ formId: string }>();
  const [formName, setFormName] = useState<string>("");

  useEffect(() => {
    if (!formId) return;
    (async () => {
      const { data } = await supabase
        .from("smartops_forms" as any)
        .select("name,title")
        .eq("id", formId)
        .maybeSingle();
      const d = data as any;
      if (d) setFormName(d.title || d.name || "");
    })();
  }, [formId]);

  if (!formId) {
    return <div className="p-6 text-sm text-muted-foreground">Formulário não informado.</div>;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-semibold text-sm truncate">
            Fluxo: {formName || formId}
          </h1>
          <Badge variant="outline" className="gap-1.5">
            <span className="relative inline-flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
            </span>
            <span className="text-[11px]">Ao vivo · atualiza ao salvar</span>
          </Badge>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Arraste esta janela para outro monitor
        </span>
      </header>
      <div className="flex-1 overflow-hidden p-3">
        <div className="h-full [&>div]:h-full [&>div>div:last-child]:!h-full">
          <SmartOpsFormFlowPreview formId={formId} />
        </div>
      </div>
    </div>
  );
}