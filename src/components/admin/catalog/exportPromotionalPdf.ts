import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { getStorageImageUrl } from "@/utils/storageImage";
import { groupItemsByCategory } from "@/components/smartops/distributors/DealerProposalExport";
import { formatMoney } from "@/components/smartops/distributors/types";
import type { PromotionalSectionWithItems, PromotionalTable } from "./promotionalTypes";
import { itemTotals } from "./promotionalTypes";

const money = (value: number, currency?: string | null) => {
  const safe = (currency || "BRL").toUpperCase();
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: safe }).format(Number(value) || 0);
  } catch {
    return `${safe} ${(Number(value) || 0).toFixed(2)}`;
  }
};

const date = (value: string | null) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
  : "—";

type ImgEntry = { dataUrl: string; format: "JPEG" | "PNG" } | null;

async function loadImage(rawUrl: string | null | undefined, width = 480): Promise<ImgEntry> {
  if (!rawUrl) return null;
  try {
    const url = getStorageImageUrl(rawUrl, { width, quality: 70 });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal, mode: "cors" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!(blob.type || "").toLowerCase().startsWith("image/")) return null;
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const mime = (blob.type || "").toLowerCase();
    return { dataUrl, format: mime.includes("jpeg") || mime.includes("jpg") ? "JPEG" : "PNG" };
  } catch {
    return null;
  }
}

/** Official Smart Dent (Loja Oficial) price list, rendered with the dealer PDF layout. */
async function fetchOfficialPriceList() {
  const { data: distributor } = await supabase
    .from("distributors" as any)
    .select("id,razao_social,nome_fantasia")
    .ilike("nome_fantasia", "%Loja Oficial%")
    .limit(1)
    .maybeSingle();
  if (!distributor) return null;
  const { data: list } = await supabase
    .from("dealer_price_lists" as any)
    .select("*")
    .eq("distributor_id", (distributor as any).id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!list) return null;
  const { data: items } = await supabase
    .from("dealer_price_items" as any)
    .select("*")
    .eq("price_list_id", (list as any).id);
  if (!items || !(items as any[]).length) return null;
  return { distributor: distributor as any, list: list as any, items: items as any[] };
}

export async function exportPromotionalPdf(
  table: PromotionalTable,
  sections: PromotionalSectionWithItems[],
  distributorName?: string,
  mode: "download" | "preview" = "download",
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 28;
  const pageTop = 118;
  const pageBottom = 48;
  const dark: [number, number, number] = [31, 59, 84];
  const accent: [number, number, number] = [235, 109, 36];

  const header = () => {
    doc.setFillColor(...dark);
    doc.rect(0, 0, width, 92, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("SMART DENT | FLUXO DIGITAL", margin, 34);
    doc.setFontSize(15);
    doc.text(table.pdf_title || table.name, margin, 58);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const validity = table.valid_from || table.valid_until
      ? `Validade: ${date(table.valid_from)} a ${date(table.valid_until)}`
      : "Condições válidas conforme disponibilidade";
    doc.text([distributorName ? `Distribuidor: ${distributorName}` : "Tabela geral Smart Dent", validity].join("  •  "), margin, 76);
    doc.setFillColor(...accent);
    doc.rect(0, 92, width, 4, "F");
    doc.setTextColor(0, 0, 0);
  };

  // Preload combo photos before drawing (fetches are async, jsPDF drawing is not).
  const comboImages = new Map<string, ImgEntry>();
  await Promise.all(sections.map(async (section) => {
    if (!section.image_url) return;
    comboImages.set(section.id, await loadImage(section.image_url, 520));
  }));

  header();
  let y = pageTop;
  const allItems = sections.flatMap((section) => section.items);
  const totals = allItems.reduce((acc, item) => {
    const row = itemTotals(item);
    acc.market += row.market;
    acc.promotional += row.promotional;
    return acc;
  }, { market: 0, promotional: 0 });

  for (const [index, section] of sections.entries()) {
    if (y > height - 150) {
      doc.addPage();
      header();
      y = pageTop;
    }
    doc.setFillColor(...dark);
    doc.rect(margin, y, width - margin * 2, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${index + 1} — ${section.title}`, margin + 8, y + 16);
    doc.setTextColor(0, 0, 0);
    y += 28;

    // Combo presentation row: photo on the left column, description on the right.
    const image = comboImages.get(section.id);
    const hasDescription = Boolean(section.description && section.description.trim());
    if (image || hasDescription) {
      const blockW = width - margin * 2;
      const blockH = 120;
      if (y + blockH > height - pageBottom - 40) {
        doc.addPage();
        header();
        y = pageTop;
      }
      const colGap = 14;
      const photoW = image ? blockW * 0.38 : 0;
      doc.setDrawColor(225, 228, 231);
      doc.setFillColor(250, 251, 252);
      doc.roundedRect(margin, y, blockW, blockH, 4, 4, "FD");
      if (image) {
        try {
          const boxW = photoW - 16;
          const boxH = blockH - 16;
          const props = (doc as any).getImageProperties?.(image.dataUrl);
          const ratio = props?.width && props?.height ? props.width / props.height : 1;
          let drawW = boxW;
          let drawH = boxW / ratio;
          if (drawH > boxH) { drawH = boxH; drawW = boxH * ratio; }
          doc.addImage(
            image.dataUrl,
            image.format,
            margin + 8 + (boxW - drawW) / 2,
            y + 8 + (boxH - drawH) / 2,
            drawW,
            drawH,
            undefined,
            "FAST",
          );
        } catch { /* imagem inválida — segue sem foto */ }
      }
      if (hasDescription) {
        const textX = margin + (image ? photoW + colGap : 14);
        const textW = blockW - (image ? photoW + colGap : 14) - 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(55, 60, 66);
        const lines = doc.splitTextToSize(String(section.description), textW).slice(0, 9);
        doc.text(lines, textX, y + 24, { lineHeightFactor: 1.35 });
        doc.setTextColor(0, 0, 0);
      }
      y += blockH + 10;
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: pageTop, bottom: pageBottom },
      head: [["Item", "Qtd.", "Valor de mercado", "Valor promocional", "Economia", "Desc. %"]],
      body: section.items.map((item) => {
        const row = itemTotals(item);
        return [
          `${item.name}${item.sku ? `\nSKU: ${item.sku}` : ""}`,
          String(item.quantity),
          money(row.market, table.currency),
          money(row.promotional, table.currency),
          money(row.savings, table.currency),
          `${row.discount.toFixed(1)}%`,
        ];
      }),
      styles: { fontSize: 8, cellPadding: 5, lineColor: [210, 214, 218], lineWidth: 0.4, valign: "middle" },
      headStyles: { fillColor: dark, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 247] },
      columnStyles: { 0: { cellWidth: 190 }, 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      didDrawPage: header,
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 5;
    const sectionTotal = section.items.reduce((sum, item) => sum + itemTotals(item).promotional, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`Subtotal promocional: ${money(sectionTotal, table.currency)}`, width - margin, y + 10, { align: "right" });
    y += 24;
  }

  if (y > height - 130) {
    doc.addPage();
    header();
    y = pageTop;
  }
  const savings = totals.market - totals.promotional;
  const discount = totals.market > 0 ? (savings / totals.market) * 100 : 0;
  doc.setFillColor(245, 246, 247);
  doc.roundedRect(width - margin - 300, y + 8, 300, 86, 4, 4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Valor de mercado", width - margin - 286, y + 28);
  doc.text(money(totals.market, table.currency), width - margin - 14, y + 28, { align: "right" });
  doc.text("Economia total", width - margin - 286, y + 47);
  doc.text(`${money(savings, table.currency)} (${discount.toFixed(1)}%)`, width - margin - 14, y + 47, { align: "right" });
  doc.setFillColor(...dark);
  doc.rect(width - margin - 300, y + 59, 300, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("VALOR PROMOCIONAL", width - margin - 286, y + 82);
  doc.text(money(totals.promotional, table.currency), width - margin - 14, y + 82, { align: "right" });
  doc.setTextColor(0, 0, 0);
  if (table.notes) {
    doc.setTextColor(70, 70, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(table.notes, width - margin * 2), margin, y + 116);
  }

  // ---- Official Smart Dent price table, appended at the end ----
  if (table.include_official_price_table !== false) {
    const official = await fetchOfficialPriceList();
    if (official) {
      const currency = official.list?.currency ?? "BRL";
      const photos = new Map<string, ImgEntry>();
      await Promise.all(official.items.map(async (item: any) => {
        if (!item.image_url) return;
        photos.set(item.id, await loadImage(item.image_url, 160));
      }));

      doc.addPage();
      header();
      let cursor = pageTop;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("TABELA DE PREÇOS — SMART DENT (LOJA OFICIAL)", margin, cursor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Versão ${official.list?.version ?? 1} • Moeda ${currency}`, margin, cursor + 14);
      doc.setTextColor(0, 0, 0);
      cursor += 28;

      const contentW = width - margin * 2;
      const head = [[
        "Foto", "Produto", "SKU", "NCM", "GTIN", "Variante", "Pres", "Cor",
        "Qtd", "Preço unit.", "Desc %", `Desc (${currency})`, "Total",
      ]];
      const columnStyles: Record<number, any> = {
        0: { cellWidth: 30, halign: "center", valign: "middle" },
        1: { cellWidth: 96, fontStyle: "bold" },
        2: { cellWidth: 36, halign: "center" },
        3: { cellWidth: 42, halign: "center", fontSize: 5.5 },
        4: { cellWidth: 58, halign: "center", fontSize: 5.5 },
        5: { cellWidth: 32, halign: "center" },
        6: { cellWidth: 22, halign: "center" },
        7: { cellWidth: 42, halign: "center" },
        8: { cellWidth: 22, halign: "right" },
        9: { cellWidth: 44, halign: "right" },
        10: { cellWidth: 28, halign: "right" },
        11: { cellWidth: 42, halign: "right" },
        12: { cellWidth: 44, halign: "right", fontStyle: "bold" },
      };

      const band = (label: string, isDark: boolean) => {
        if (cursor + 20 > height - pageBottom) {
          doc.addPage();
          header();
          cursor = pageTop;
        }
        const h = isDark ? 16 : 13;
        if (isDark) doc.setFillColor(...dark); else doc.setFillColor(229, 229, 229);
        doc.rect(margin, cursor, contentW, h, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(isDark ? 8 : 7);
        doc.setTextColor(isDark ? 255 : 20, isDark ? 255 : 20, isDark ? 255 : 20);
        doc.text(label, margin + 6, cursor + (isDark ? 11 : 9));
        doc.setTextColor(0, 0, 0);
        cursor += h + 2;
      };

      for (const group of groupItemsByCategory(official.items as any)) {
        band(group.category.toUpperCase(), true);
        for (const sub of group.subs) {
          if (group.subs.length > 1 || sub.subcategory !== "Geral") band(sub.subcategory, false);
          const rows = sub.rows as any[];
          autoTable(doc, {
            startY: cursor,
            margin: { left: margin, right: margin, top: pageTop, bottom: pageBottom },
            head,
            body: rows.map((item) => {
              const qty = Number(item.quantity_multiplier ?? 1) || 1;
              const descAbs = (Number(item.price_base || 0) - Number(item.price_dealer || 0)) * qty;
              return [
                "",
                item.name,
                item.sku ?? item.cod ?? "—",
                item.ncm_hs ?? "",
                item.gtin_ean ?? "",
                item.variant ?? item.presentation_qty ?? "",
                item.presentation ?? "",
                item.color ?? "",
                String(qty),
                formatMoney(item.price_base, currency),
                `${Number(item.discount_pct ?? 0).toFixed(1)}%`,
                formatMoney(descAbs, currency),
                formatMoney(Number(item.price_dealer || 0) * qty, currency),
              ];
            }),
            styles: { fontSize: 5.5, cellPadding: 3, overflow: "linebreak", lineColor: [220, 220, 220], lineWidth: 0.3, minCellHeight: 28, valign: "middle", textColor: [35, 35, 35] },
            headStyles: { fillColor: [54, 62, 86], textColor: 255, fontSize: 5.5, fontStyle: "bold", halign: "center", valign: "middle", cellPadding: 4 },
            alternateRowStyles: { fillColor: [250, 250, 251] },
            columnStyles,
            theme: "grid",
            didDrawPage: header,
            didDrawCell: (data) => {
              if (data.section !== "body" || data.column.index !== 0) return;
              const item = rows[data.row.index];
              const entry = item ? photos.get(item.id) : null;
              if (!entry) return;
              const pad = 2;
              const size = Math.min(data.cell.width, data.cell.height) - pad * 2;
              try {
                doc.addImage(
                  entry.dataUrl,
                  entry.format,
                  data.cell.x + (data.cell.width - size) / 2,
                  data.cell.y + (data.cell.height - size) / 2,
                  size,
                  size,
                  undefined,
                  "FAST",
                );
              } catch { /* imagem inválida */ }
            },
          });
          cursor = ((doc as any).lastAutoTable?.finalY ?? cursor) + 4;
        }
      }
    }
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setTextColor(110, 110, 110);
    doc.setFontSize(7);
    doc.text("smartdent.com.br", margin, height - 20);
    doc.text(`Página ${page} de ${pages}`, width - margin, height - 20, { align: "right" });
  }

  const filename = table.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (mode === "preview") {
    const url = doc.output("bloburl");
    window.open(String(url), "_blank", "noopener,noreferrer");
    return;
  }
  doc.save(`tabela-promocional-${filename || "smart-dent"}.pdf`);
}
