import { canonFromCatalogRow, normCat } from "../components/knowledge/kbCategoryTaxonomy";
import type { DistributorLanguage } from "./distributorI18n";

const clean = (text: string) => text.trim().replace(/^\d+(?:\.\d+)*\.?\s*/, "").replace(/\s+/g, " ");
const key = (text: string) => clean(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const labels: Record<string, [string, string, string]> = {
  "SCANNERS 3D": ["Scanners 3D", "Escáneres 3D", "3D scanners"],
  "RESINAS 3D": ["Resinas 3D", "Resinas 3D", "3D resins"],
  "IMPRESSAO 3D": ["Impressão 3D", "Impresión 3D", "3D printing"],
  "POS-IMPRESSAO": ["Pós-impressão", "Posimpresión", "Post-printing"],
  "CARACTERIZACAO": ["Caracterização", "Caracterización", "Characterization"],
  "DENTISTICA, ESTETICA E ORTODONTIA": ["Dentística, estética e ortodontia", "Odontología restauradora, estética y ortodoncia", "Restorative dentistry, esthetics and orthodontics"],
  "SOFTWARES": ["Softwares", "Software", "Software"],
  "SOFTWARE": ["Software", "Software", "Software"],
  "SCANNER INTRAORAL": ["Scanner intraoral", "Escáner intraoral", "Intraoral scanner"],
  "SCANNER BANCADA": ["Scanner de bancada", "Escáner de laboratorio", "Lab scanner"],
  "ACESSORIOS": ["Acessórios", "Accesorios", "Accessories"],
  "SERVICO": ["Serviços", "Servicios", "Services"],
  "RESINAS 3D - BIOCOMPATIVEIS": ["Resinas biocompatíveis", "Resinas biocompatibles", "Biocompatible resins"],
  "RESINAS 3D - USO GERAL": ["Resinas de uso geral", "Resinas de uso general", "General-purpose resins"],
  "IMPRESSORA 3D - ODONTOLOGICA": ["Impressoras odontológicas", "Impresoras dentales", "Dental printers"],
  "IMPRESSORA 3D - DESKTOP": ["Impressoras desktop", "Impresoras de escritorio", "Desktop printers"],
  "EQUIPAMENTOS": ["Equipamentos", "Equipos", "Equipment"],
  "LIMPEZA/ACABAMENTO": ["Limpeza e acabamento", "Limpieza y acabado", "Cleaning and finishing"],
  "CARACTERIZACAO SMARTMAKE": ["Caracterização SmartMake", "Caracterización SmartMake", "SmartMake characterization"],
  "CARACTERIZACAO SMARTGUM": ["Caracterização SmartGum", "Caracterización SmartGum", "SmartGum characterization"],
  "DENTISTICA/ORTO": ["Dentística e ortodontia", "Odontología restauradora y ortodoncia", "Restorative dentistry and orthodontics"],
  "CIMENTOS": ["Cimentos", "Cementos", "Cements"],
  "RESINAS COMPOSTAS": ["Resinas compostas", "Resinas compuestas", "Composite resins"],
  "INSUMOS": ["Insumos", "Insumos", "Supplies"],
};

/** Labels are presentation only: option values retain the original catalog strings. */
export function distributorTaxonomyLabel(text: string, language: DistributorLanguage): string {
  const known = labels[key(text)];
  if (known) return known[language === "pt" ? 0 : language === "es" ? 1 : 2];
  const normalized = clean(text);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase().replace(/3d\b/g, "3D");
}

export function distributorTaxonomyCategory(category: string, subcategory: string | null): string | null {
  if (/DENTISTICA|ORTODONTIA|DENTISTICA\/ORTO/.test(key(subcategory || ""))) {
    return "DENTÍSTICA, ESTÉTICA E ORTODONTIA";
  }
  return canonFromCatalogRow(category, subcategory) || normCat(category);
}

export function uniqueDistributorSubcategories(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const normalized = key(value);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}