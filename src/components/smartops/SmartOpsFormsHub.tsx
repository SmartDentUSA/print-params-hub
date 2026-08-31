import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmartOpsFormBuilder } from "@/components/SmartOpsFormBuilder";
import { BioLinkPanel } from "@/components/smartops/bio/BioLinkPanel";
import { FormHeroImageStudio } from "@/components/smartops/forms/FormHeroImageStudio";

export function SmartOpsFormsHub() {
  return (
    <Tabs defaultValue="formularios" className="space-y-4">
      <TabsList>
        <TabsTrigger value="formularios">Formulários</TabsTrigger>
        <TabsTrigger value="hero-ia">Hero por IA</TabsTrigger>
        <TabsTrigger value="link-na-bio">Link da Bio</TabsTrigger>
      </TabsList>
      <TabsContent value="formularios">
        <SmartOpsFormBuilder />
      </TabsContent>
      <TabsContent value="hero-ia">
        <FormHeroImageStudio />
      </TabsContent>
      <TabsContent value="link-na-bio">
        <BioLinkPanel />
      </TabsContent>
    </Tabs>
  );
}
