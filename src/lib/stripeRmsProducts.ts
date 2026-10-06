export type RmsFamily = "dentalcad" | "exoplan";

export function rmsFamily(raw: string | null | undefined): RmsFamily | null {
  const text = (raw || "").toLowerCase();
  if (text.includes("exoplan") || text.includes("guide creator") || text.includes("guide_creator")) return "exoplan";
  if (!text || text.includes("dentalcad") || text.includes("exocad") || text.includes("ultimate bundle") || text.includes("ultimate lab bundle")) return "dentalcad";
  return null;
}

export function familyLeadKey(family: RmsFamily | null, leadId: string): string {
  return `${family ?? "unknown"}:${leadId}`;
}

export function resolveCatalogProduct(raw: string | null | undefined, chargeKind?: string | null): { name: string; slug: string | null } | null {
  const family = rmsFamily(raw);
  if (!family) return null;
  const text = (raw || "").toLowerCase();
  const activation = chargeKind === "ativacao" || (chargeKind !== "mensalidade" && /ativa|implanta|setup/.test(text));
  if (family === "exoplan") {
    return activation
      ? { name: "Ativação e Implantação exoplan RMS + Guide Creator", slug: "ativacao-exoplan-rms-guide-creator" }
      : { name: "Mensalidade exoplan RMS + Guide Creator", slug: null };
  }
  return activation
    ? { name: "Ativação DentalCAD Ultimate Lab Bundle - RMS", slug: "ativacao-dentalcad-ultimate-lab-bundle-rms" }
    : { name: "Assinatura mensal DentalCAD Ultimate Lab Bundle - RMS", slug: "mensalidade-dentalcad-ultimate-lab-bundle-rms" };
}