import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Download, ExternalLink } from "lucide-react";
import sealAsset from "@/assets/selo-distribuidor-oficial-smart-dent.png.asset.json";

const BASE_URL = "https://admin.smartdent.com.br";

type CountryDef = { slug: string; aliases: string[]; name: string; iso: string; prep: string };
const COUNTRIES: CountryDef[] = [
  { slug: "brasil", aliases: ["brazil", "br"], name: "Brasil", iso: "BR", prep: "no" },
  { slug: "chile", aliases: ["cl"], name: "Chile", iso: "CL", prep: "no" },
  { slug: "colombia", aliases: ["colômbia", "co"], name: "Colômbia", iso: "CO", prep: "na" },
  { slug: "costa-rica", aliases: ["costarica", "cr"], name: "Costa Rica", iso: "CR", prep: "na" },
  { slug: "republica-dominicana", aliases: ["dominicana", "do"], name: "República Dominicana", iso: "DO", prep: "na" },
  { slug: "estados-unidos", aliases: ["eua", "usa", "united-states"], name: "Estados Unidos", iso: "US", prep: "nos" },
  { slug: "uruguai", aliases: ["uruguay", "uy"], name: "Uruguai", iso: "UY", prep: "no" },
  { slug: "venezuela", aliases: ["ve"], name: "Venezuela", iso: "VE", prep: "na" },
];

function normalizeKey(s?: string | null) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
function findCountry(slugOrName?: string | null) {
  const k = normalizeKey(slugOrName);
  return COUNTRIES.find((c) => c.slug === k || c.aliases.includes(k) || normalizeKey(c.name) === k);
}

export type KitDistributor = {
  razao_social: string;
  nome_fantasia: string | null;
  pais: string | null;
  slug: string | null;
};

export function DistributorKitDialog({
  open,
  onOpenChange,
  distributor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  distributor: KitDistributor | null;
}) {
  const sealUrl = `${BASE_URL}${sealAsset.url}`;
  const data = useMemo(() => {
    if (!distributor) return null;
    const country = findCountry(distributor.pais);
    const name = distributor.nome_fantasia || distributor.razao_social;
    const slug = distributor.slug || normalizeKey(distributor.nome_fantasia || distributor.razao_social);
    const canonical = country ? `${BASE_URL}/distribuidores/${country.slug}/${slug}` : `${BASE_URL}/distribuidores`;
    return { country, name, canonical };
  }, [distributor]);

  if (!data || !distributor) return null;
  const { country, name, canonical } = data;
  const countryName = country?.name || distributor.pais || "";
  const prep = country?.prep || "em";

  const htmlSnippet = (lang: "pt" | "es" | "en") => {
    const label = {
      pt: `Distribuidor Oficial Smart Dent ${prep} ${countryName}`,
      es: `Distribuidor Oficial Smart Dent en ${countryName}`,
      en: `Official Smart Dent Distributor in ${countryName}`,
    }[lang];
    const cta = { pt: "Verificar no site oficial", es: "Verificar en el sitio oficial", en: "Verify on official website" }[lang];
    return `<!-- Selo Distribuidor Oficial Smart Dent -->
<a href="${canonical}" target="_blank" rel="noopener" title="${label}" style="display:inline-flex;align-items:center;gap:12px;text-decoration:none;color:#0f172a;font-family:system-ui,sans-serif;">
  <img src="${sealUrl}" alt="Distribuidor Oficial Certificado Smart Dent Brasil" width="140" height="140" loading="lazy" style="border:0;" />
  <span style="display:flex;flex-direction:column;line-height:1.2;">
    <strong style="font-size:13px;">${label}</strong>
    <small style="font-size:11px;color:#64748b;">${cta} →</small>
  </span>
</a>`;
  };

  const slug = (distributor.slug || distributor.nome_fantasia || distributor.razao_social || "parceiro")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const utm = `?utm_source=distribuidor&utm_medium=backlink&utm_campaign=${slug}`;
  const logoBacklink = (lang: "pt" | "es" | "en") => {
    const alt = {
      pt: "Smart Dent — fabricante oficial",
      es: "Smart Dent — fabricante oficial",
      en: "Smart Dent — official manufacturer",
    }[lang];
    return `<!-- Backlink obrigatório para o fabricante Smart Dent -->
<a href="https://www.smartdent.com.br${utm}" target="_blank" rel="noopener" title="${alt}" style="display:inline-block;text-decoration:none;">
  <img src="https://www.smartdent.com.br/logo-smartdent.png" alt="${alt}" width="140" height="48" loading="lazy" style="border:0;" />
</a>`;
  };

  const bio = (lang: "pt" | "es" | "en") =>
    ({
      pt: `🦷 ${name} — Distribuidor Oficial Smart Dent ${prep} ${countryName}. Resinas 3D, kits e insumos odontológicos. Verificado: ${canonical}`,
      es: `🦷 ${name} — Distribuidor Oficial Smart Dent en ${countryName}. Resinas 3D, kits e insumos odontológicos. Verificado: ${canonical}`,
      en: `🦷 ${name} — Official Smart Dent Distributor in ${countryName}. 3D resins, kits and dental supplies. Verified: ${canonical}`,
    }[lang]);

  const press = (lang: "pt" | "es" | "en") =>
    ({
      pt: `${name} é distribuidor oficial e autorizado da Smart Dent ${prep} ${countryName}, comercializando linhas como SmartMake, resinas 3D para impressão e kits de maquiagem odontológica. A relação está publicamente listada em ${canonical}.`,
      es: `${name} es distribuidor oficial y autorizado de Smart Dent en ${countryName}, comercializando líneas como SmartMake, resinas 3D para impresión y kits de maquillaje odontológico. La relación está publicada oficialmente en ${canonical}.`,
      en: `${name} is the official, authorized distributor of Smart Dent in ${countryName}, carrying lines such as SmartMake, 3D printing resins and dental makeup kits. The partnership is publicly listed at ${canonical}.`,
    }[lang]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const Block = ({ value, label }: { value: string; label: string }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Button size="sm" variant="ghost" onClick={() => copy(value, label)}>
          <Copy className="w-3 h-3 mr-1" /> Copiar
        </Button>
      </div>
      <Textarea value={value} readOnly rows={6} className="font-mono text-xs" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kit de Divulgação — {name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
            <img src={sealUrl} alt="Selo Distribuidor Oficial Smart Dent" width={88} height={88} className="rounded bg-white p-1" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">URL canônica (compartilhe este link)</p>
              <a href={canonical} target="_blank" rel="noopener" className="text-xs text-primary break-all inline-flex items-center gap-1">
                {canonical} <ExternalLink className="w-3 h-3" />
              </a>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => copy(canonical, "Link canônico")}>
                  <Copy className="w-3 h-3 mr-1" /> Copiar link
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={sealUrl} download="selo-distribuidor-oficial-smart-dent.png">
                    <Download className="w-3 h-3 mr-1" /> Baixar selo PNG
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <Tabs defaultValue="pt">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="pt">Português 🇧🇷</TabsTrigger>
              <TabsTrigger value="es">Español 🇪🇸</TabsTrigger>
              <TabsTrigger value="en">English 🇺🇸</TabsTrigger>
            </TabsList>
            {(["pt", "es", "en"] as const).map((lang) => (
              <TabsContent key={lang} value={lang} className="space-y-4 pt-4">
                <Block label="Selo HTML — cole no rodapé do site / e-commerce" value={htmlSnippet(lang)} />
                <Block label="Backlink obrigatório — logo Smart Dent linkado (com UTM)" value={logoBacklink(lang)} />
                <Block label="Bio para Instagram / WhatsApp / LinkedIn" value={bio(lang)} />
                <Block label="Texto institucional (sobre / press kit)" value={press(lang)} />
              </TabsContent>
            ))}
          </Tabs>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Por que isto importa:</strong> backlinks dos sites dos distribuidores apontando para a URL canônica acima são o sinal #1 que Google, Perplexity e ChatGPT usam para confirmar oficialmente que <em>{name}</em> é distribuidor Smart Dent {prep} {countryName}.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}