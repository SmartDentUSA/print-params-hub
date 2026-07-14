import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { SmartOpsDistributors } from "../SmartOpsDistributors";
import { DealerCatalogGrid } from "./DealerCatalogGrid";
import { DealerPriceTable } from "./DealerPriceTable";
import { DealerProposalWizard } from "./DealerProposalWizard";
import type { Distributor } from "./types";

const TAB_HELP: Record<string, string> = {
  cadastro: "Cadastro completo dos distribuidores credenciados (endereço, contato do comprador, redes sociais, kit institucional).",
  catalogo: "Galeria visual com todos os produtos ativos do catálogo Smart Dent (foto, preço base, categoria). Ideal para demonstrações e para escolher itens que vão para as tabelas de preço.",
  tabela: "Tabela de preço editável por distribuidor. Importa todo o catálogo, permite ajustar COD, NCM/HS, GTIN, preço tabela, % desconto e preço dealer (recálculo automático). Exporta XLSX/PDF/DOCX.",
  proposta: "Wizard em 3 etapas para gerar uma proposta comercial: escolhe o distribuidor, seleciona categorias e produtos, edita o preview inline e exporta para XLSX/PDF/DOCX. A proposta salva fica versionada em dealer_proposals.",
};

export function DistributorsHub() {
  const [tab, setTab] = useState("cadastro");
  const [distributors, setDistributors] = useState<Distributor[]>([]);

  const loadDistributors = async () => {
    const { data } = await supabase
      .from("distributors" as any)
      .select("id,razao_social,nome_fantasia,logo_url,pais,estado,cidade,buyer_name,buyer_email,owner_name,owner_email,active")
      .eq("active", true)
      .order("razao_social", { ascending: true });
    setDistributors(((data as any) || []) as Distributor[]);
  };

  useEffect(() => { loadDistributors(); }, []);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="cadastro">Distribuidores</TabsTrigger>
        <TabsTrigger value="catalogo">Catálogo de Produtos</TabsTrigger>
        <TabsTrigger value="tabela">Tabela de Preço</TabsTrigger>
        <TabsTrigger value="proposta">Gerar Proposta</TabsTrigger>
      </TabsList>

      <div className="text-xs text-muted-foreground leading-relaxed border rounded-md p-2 bg-muted/40">
        {TAB_HELP[tab]}
      </div>

      <TabsContent value="cadastro"><SmartOpsDistributors /></TabsContent>
      <TabsContent value="catalogo"><DealerCatalogGrid /></TabsContent>
      <TabsContent value="tabela">
        <DealerPriceTable
          distributors={distributors}
          onGenerateProposal={() => setTab("proposta")}
        />
      </TabsContent>
      <TabsContent value="proposta"><DealerProposalWizard distributors={distributors} /></TabsContent>
    </Tabs>
  );
}