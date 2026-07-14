import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType } from "docx";
import { saveAs } from "file-saver";
import type { DealerPriceItem, DealerPriceList, Distributor } from "./types";
import { formatMoney } from "./types";
import proposalBgAsset from "@/assets/proposal-bg.png.asset.json";

function fileBase(distributor: Distributor | undefined, list: DealerPriceList | null, prefix = "tabela-preco") {
  const dist = (distributor?.nome_fantasia || distributor?.razao_social || "distribuidor").replace(/\W+/g, "-").toLowerCase();
  const ts = new Date().toISOString().slice(0, 10);
  return `${prefix}-${dist}-v${list?.version ?? 1}-${ts}`;
}

// ---------- Background helpers ----------
let bgDataUrlCache: string | null = null;
async function loadProposalBg(): Promise<string> {
  if (bgDataUrlCache) return bgDataUrlCache;
  const res = await fetch(proposalBgAsset.url);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  bgDataUrlCache = dataUrl;
  return dataUrl;
}

function resolveDealerId(d: Distributor | undefined): string {
  const anyD = (d ?? {}) as any;
  return anyD.id_dealer || anyD.dealer_code || anyD.codigo_dealer || (d?.id ? d.id.slice(0, 8).toUpperCase() : "—");
}

function localeForLang(lang: string | null | undefined): string {
  const l = (lang || "pt").toLowerCase();
  if (l.startsWith("es")) return "es-ES";
  if (l.startsWith("en")) return "en-US";
  return "pt-BR";
}

/** Group items keeping first-seen order of categories/subcategories. */
function groupItemsByCategory(items: DealerPriceItem[]) {
  type Row = { category: string; subs: { subcategory: string; rows: DealerPriceItem[] }[] };
  const map = new Map<string, Row>();
  for (const it of items) {
    const cat = (it.category ?? "").trim() || "Outros";
    const sub = (it.subcategory ?? "").trim() || "Geral";
    let entry = map.get(cat);
    if (!entry) { entry = { category: cat, subs: [] }; map.set(cat, entry); }
    let subEntry = entry.subs.find((s) => s.subcategory === sub);
    if (!subEntry) { subEntry = { subcategory: sub, rows: [] }; entry.subs.push(subEntry); }
    subEntry.rows.push(it);
  }
  return [...map.values()];
}

/** XLSX with a formula for Preço Dealer so it stays live in Excel. */
export function exportPriceTableXlsx(
  distributor: Distributor | undefined,
  list: DealerPriceList | null,
  items: DealerPriceItem[],
  filenamePrefix = "tabela-preco",
) {
  const header = ["COD", "Produto", "Categoria", "Subcategoria", "Variante", "NCM/HS", "GTIN/EAN", "Unid", "Descrição", "Preço tabela", "% Desconto", "Preço dealer"];
  const aoa: any[][] = [header];
  items.forEach((it, idx) => {
    const row = idx + 2; // 1 = header
    aoa.push([
      it.cod ?? "", it.name, it.category ?? "", it.subcategory ?? "", it.variant ?? "",
      it.ncm_hs ?? "", it.gtin_ean ?? "", it.unidade ?? "UN", it.description ?? "",
      Number(it.price_base) || 0,
      Number(it.discount_pct) || 0,
      { f: `ROUND(J${row}*(1-K${row}/100),2)` },
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 10 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 40 },
    { wch: 14 }, { wch: 10 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tabela de Preço");

  const meta = [
    ["Distribuidor", distributor?.razao_social ?? ""],
    ["Nome fantasia", distributor?.nome_fantasia ?? ""],
    ["País", distributor?.pais ?? ""],
    ["Contato", distributor?.buyer_name ?? distributor?.owner_name ?? ""],
    ["E-mail", distributor?.buyer_email ?? distributor?.owner_email ?? ""],
    ["Moeda", list?.currency ?? "BRL"],
    ["Versão", list?.version ?? 1],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Cabeçalho");

  XLSX.writeFile(wb, `${fileBase(distributor, list, filenamePrefix)}.xlsx`);
}

/** PDF that mirrors the invoice layout: header block + Price Table. */
export async function exportPriceTablePdf(
  distributor: Distributor | undefined,
  list: DealerPriceList | null,
  items: DealerPriceItem[],
  opts: { title?: string; filenamePrefix?: string } = {},
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 595.28
  const pageH = doc.internal.pageSize.getHeight();  // 841.89
  const currency = list?.currency ?? "BRL";
  const locale = localeForLang(list?.language);
  const bg = await loadProposalBg();

  const empresa = distributor?.nome_fantasia ?? distributor?.razao_social ?? "—";
  const razao = distributor?.razao_social ?? "—";
  const contato = distributor?.buyer_name ?? distributor?.owner_name ?? "—";
  const email = distributor?.buyer_email ?? distributor?.owner_email ?? "—";
  const pais = distributor?.pais ?? "—";
  const dealerId = resolveDealerId(distributor);
  const dataStr = new Date(list?.created_at ?? Date.now()).toLocaleDateString(locale);

  // Draw background + overlay all header fields on the current page
  const drawPageChrome = () => {
    doc.addImage(bg, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 20);

    // Field values sit right after the printed labels (positions measured from the PDF).
    // Empresa: label at (24, 100); value:
    doc.text(String(empresa).slice(0, 60), 68, 107);
    // Razão Social: label ~(300, 100)
    doc.text(String(razao).slice(0, 60), 356, 107);
    // Contato — Responsável de Compras: label at (24, 109)
    doc.text(String(contato).slice(0, 80), 165, 116);
    // E-mail: label at (24, 118)
    doc.text(String(email).slice(0, 80), 55, 125);
    // País: label at (24, 127)
    doc.text(String(pais).slice(0, 40), 46, 134);
    // ID Dealer SmartDent: label at (24, 135)
    doc.text(String(dealerId).slice(0, 40), 122, 143);
    // DATA DA PROPOSTA header at (497, 136) — value just below
    doc.setFont("helvetica", "normal");
    doc.text(dataStr, pageW - 40, 152, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  drawPageChrome();

  // Table area: y 160 → 790 (footer starts ~800)
  const tableTop = 165;
  const tableBottom = 790;
  const leftMargin = 28;
  const rightMargin = 28;
  const contentW = pageW - leftMargin - rightMargin;

  const head = [[
    "Foto", "COD", "Produto", "Pres #", "Pres", "NCM/HS", "GTIN/EAN", "Unid (×)",
    "Preço tabela", "% Desc.", "Preço dealer",
  ]];
  // Column widths sum ≈ contentW (539)
  const columnStyles: Record<number, any> = {
    0: { cellWidth: 34, halign: "center" },
    1: { cellWidth: 46 },
    2: { cellWidth: 130 },
    3: { cellWidth: 34, halign: "right" },
    4: { cellWidth: 34 },
    5: { cellWidth: 50 },
    6: { cellWidth: 66 },
    7: { cellWidth: 34, halign: "right" },
    8: { cellWidth: 50, halign: "right" },
    9: { cellWidth: 34, halign: "right" },
    10: { cellWidth: 60, halign: "right", fontStyle: "bold" },
  };

  const rowFor = (it: DealerPriceItem) => [
    "", // Foto placeholder (drawn via didDrawCell if image_url available in the future)
    it.cod ?? "—",
    it.name,
    it.presentation_qty != null ? String(it.presentation_qty) : "—",
    it.presentation ?? "—",
    it.ncm_hs ?? "—",
    it.gtin_ean ?? "—",
    it.quantity_multiplier != null ? String(it.quantity_multiplier) : (it.unidade ?? "1"),
    formatMoney(it.price_base, currency),
    `${Number(it.discount_pct).toFixed(1)}%`,
    formatMoney(it.price_dealer, currency),
  ];

  let cursorY = tableTop;
  const groups = groupItemsByCategory(items);

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > tableBottom) {
      doc.addPage();
      drawPageChrome();
      cursorY = tableTop;
    }
  };

  const drawBand = (label: string, opts: { dark: boolean }) => {
    ensureSpace(18);
    const h = opts.dark ? 16 : 13;
    if (opts.dark) doc.setFillColor(31, 31, 31); else doc.setFillColor(229, 229, 229);
    doc.rect(leftMargin, cursorY, contentW, h, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(opts.dark ? 10 : 8.5);
    doc.setTextColor(opts.dark ? 255 : 20, opts.dark ? 255 : 20, opts.dark ? 255 : 20);
    doc.text(label, leftMargin + 6, cursorY + (opts.dark ? 11 : 9));
    doc.setTextColor(0, 0, 0);
    cursorY += h + 2;
  };

  for (const grp of groups) {
    drawBand(grp.category.toUpperCase(), { dark: true });
    for (const sub of grp.subs) {
      if (grp.subs.length > 1 || sub.subcategory !== "Geral") {
        drawBand(sub.subcategory, { dark: false });
      }
      autoTable(doc, {
        startY: cursorY,
        margin: { top: tableTop, bottom: pageH - tableBottom, left: leftMargin, right: rightMargin },
        head,
        body: sub.rows.map(rowFor),
        styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak", lineColor: [220, 220, 220], lineWidth: 0.3 },
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
        columnStyles,
        theme: "grid",
        didDrawPage: () => {
          // Re-draw chrome whenever autoTable starts a new page
          drawPageChrome();
        },
      });
      cursorY = ((doc as any).lastAutoTable?.finalY ?? cursorY) + 4;
    }
  }

  // Total dealer
  const total = items.reduce((a, b) => a + Number(b.price_dealer || 0), 0);
  ensureSpace(24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total dealer: ${formatMoney(total, currency)}`, pageW - rightMargin, cursorY + 14, { align: "right" });

  doc.save(`${fileBase(distributor, list, opts.filenamePrefix ?? "tabela-preco")}.pdf`);
}

/** DOCX price table. Uses DXA widths as required by the docx skill. */
export async function exportPriceTableDocx(
  distributor: Distributor | undefined,
  list: DealerPriceList | null,
  items: DealerPriceItem[],
  filenamePrefix = "tabela-preco",
) {
  const currency = list?.currency ?? "BRL";
  const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };

  // Landscape A4 content width = 16838 - 2*1440 = 13958 DXA
  const totalW = 13958;
  const widths = [900, 3400, 1800, 1800, 1400, 1600, 1258, 1800]; // sums to 13958
  const headers = ["COD", "Produto", "Variante", "GTIN/EAN", "NCM/HS", "Preço", "Desc.", "Preço dealer"];

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders, width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: "1F1F1F", type: ShadingType.CLEAR, color: "auto" },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })],
    })),
  });

  const bodyRows = items.map((it) => new TableRow({
    children: [
      it.cod ?? "—", it.name, it.variant ?? "—", it.gtin_ean ?? "—", it.ncm_hs ?? "—",
      formatMoney(it.price_base, currency), `${Number(it.discount_pct).toFixed(1)}%`, formatMoney(it.price_dealer, currency),
    ].map((val, i) => new TableCell({
      borders, width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun(String(val))], alignment: i >= 5 ? AlignmentType.RIGHT : AlignmentType.LEFT })],
    })),
  }));

  const table = new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...bodyRows],
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: "landscape" as any },
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
        },
      },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "SMART DENT — Price Table", bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `Distribuidor: ${distributor?.razao_social ?? "—"}` })] }),
        new Paragraph({ children: [new TextRun({ text: `Contato: ${distributor?.buyer_name ?? distributor?.owner_name ?? "—"}  ·  E-mail: ${distributor?.buyer_email ?? distributor?.owner_email ?? "—"}` })] }),
        new Paragraph({ children: [new TextRun({ text: `País: ${distributor?.pais ?? "—"}  ·  Moeda: ${currency}  ·  Versão: v${list?.version ?? 1}  ·  Data: ${new Date().toLocaleDateString("pt-BR")}` })] }),
        new Paragraph({ children: [new TextRun("")] }),
        table,
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "WWW.SMARTDENT.COM.BR", bold: true })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileBase(distributor, list, filenamePrefix)}.docx`);
}