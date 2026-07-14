import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType } from "docx";
import { ImageRun } from "docx";
import { saveAs } from "file-saver";
import type { DealerPriceItem, DealerPriceList, Distributor } from "./types";
import { formatMoney, categoryRank } from "./types";
import proposalBgAsset from "@/assets/proposal-bg.png.asset.json";
import { getStorageImageUrl } from "@/utils/storageImage";

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

// ---------- Image cache: url -> { dataUrl, mime, bytes } ----------
type ImgEntry = { dataUrl: string; mime: string; bytes: Uint8Array } | null;
const imgCache = new Map<string, Promise<ImgEntry>>();

async function loadImageEntry(rawUrl: string | null | undefined): Promise<ImgEntry> {
  if (!rawUrl) return null;
  const url = getStorageImageUrl(rawUrl, { width: 160, quality: 70 });
  if (imgCache.has(url)) return imgCache.get(url)!;
  const p = (async (): Promise<ImgEntry> => {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(url, { signal: ctrl.signal, mode: "cors" });
      clearTimeout(to);
      if (!res.ok) return null;
      const blob = await res.blob();
      const mime = (blob.type || "image/png").toLowerCase();
      const buf = new Uint8Array(await blob.arrayBuffer());
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      return { dataUrl, mime, bytes: buf };
    } catch {
      return null;
    }
  })();
  imgCache.set(url, p);
  return p;
}

async function preloadImages(items: DealerPriceItem[]): Promise<Map<string, ImgEntry>> {
  const out = new Map<string, ImgEntry>();
  await Promise.all(items.map(async (it) => {
    if (!it.image_url) return;
    const entry = await loadImageEntry(it.image_url);
    out.set(it.id, entry);
  }));
  return out;
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
  const groups = [...map.values()];
  // Sort categories by CATEGORY_ORDER; within a category, sort subs by rank of "cat / sub".
  groups.sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.category.localeCompare(b.category));
  for (const g of groups) {
    g.subs.sort((a, b) =>
      categoryRank(g.category, a.subcategory) - categoryRank(g.category, b.subcategory)
      || a.subcategory.localeCompare(b.subcategory)
    );
  }
  return groups;
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
  // Preload product images (silent failure per item)
  const imgs = await preloadImages(items);

  const empresa = distributor?.nome_fantasia ?? distributor?.razao_social ?? "—";
  const razao = distributor?.razao_social ?? "—";
  const contato = distributor?.buyer_name ?? distributor?.owner_name ?? "—";
  const email = distributor?.buyer_email ?? distributor?.owner_email ?? "—";
  const pais = distributor?.pais ?? "—";
  const dealerId = resolveDealerId(distributor);
  const dataStr = new Date(list?.created_at ?? Date.now()).toLocaleDateString(locale);

  // Draw background + overlay all header fields. Called BEFORE table content
  // on each page (via willDrawPage) so rows stay visible on top of the PNG.
  const paintedPages = new Set<number>();
  const drawPageChrome = () => {
    const pageNo = (doc as any).internal.getCurrentPageInfo?.().pageNumber ?? 1;
    if (paintedPages.has(pageNo)) return;
    paintedPages.add(pageNo);
    doc.addImage(bg, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    // Header field overlay — a compact block placed below the PNG title area,
    // safely inside the margin so it never crops. This is layout-independent
    // of the PNG label positions to guarantee alignment.
    const boxX = 32;
    const boxY = 118;
    const boxW = pageW - 64;
    const boxH = 92;
    doc.setDrawColor(200);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(boxX, boxY, boxW, boxH, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    const labelCol1X = boxX + 8;
    const valueCol1X = boxX + 90;
    const labelCol2X = boxX + boxW / 2 + 4;
    const valueCol2X = boxX + boxW / 2 + 86;
    const rowY = (i: number) => boxY + 14 + i * 15;
    const drawField = (lx: number, vx: number, i: number, label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 110);
      doc.text(label, lx, rowY(i));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);
      const maxW = (vx === valueCol1X ? labelCol2X - vx - 8 : boxX + boxW - vx - 8);
      const text = doc.splitTextToSize(String(value || "—"), maxW)[0];
      doc.text(text, vx, rowY(i));
    };
    drawField(labelCol1X, valueCol1X, 0, "EMPRESA",  empresa);
    drawField(labelCol2X, valueCol2X, 0, "RAZÃO SOCIAL", razao);
    drawField(labelCol1X, valueCol1X, 1, "CONTATO", contato);
    drawField(labelCol2X, valueCol2X, 1, "E-MAIL",   email);
    drawField(labelCol1X, valueCol1X, 2, "PAÍS",     pais);
    drawField(labelCol2X, valueCol2X, 2, "ID DEALER", dealerId);
    drawField(labelCol1X, valueCol1X, 3, "DATA",     dataStr);
    drawField(labelCol2X, valueCol2X, 3, "MOEDA",    currency);
    doc.setTextColor(0, 0, 0);
  };

  drawPageChrome();

  // Table area: header block ends at y=210 — start table below.
  const tableTop = 224;
  const tableBottom = 780;
  const leftMargin = 28;
  const rightMargin = 28;
  const contentW = pageW - leftMargin - rightMargin;

  // 10-column layout with a photo column. Sum = 539pt = contentW.
  const head = [[
    "Foto", "COD", "Produto", "Variante", "NCM/HS", "GTIN/EAN",
    "Unid", "Preço tabela", "% Desc.", "Preço dealer",
  ]];
  const PHOTO_COL_W = 38;
  const columnStyles: Record<number, any> = {
    0: { cellWidth: PHOTO_COL_W, halign: "center" },
    1: { cellWidth: 42 },
    2: { cellWidth: 132 },
    3: { cellWidth: 55 },
    4: { cellWidth: 44 },
    5: { cellWidth: 60 },
    6: { cellWidth: 26, halign: "right" },
    7: { cellWidth: 55, halign: "right" },
    8: { cellWidth: 33, halign: "right" },
    9: { cellWidth: 54, halign: "right", fontStyle: "bold" },
  };

  const rowFor = (it: DealerPriceItem) => [
    "", // photo cell (drawn in didDrawCell)
    it.cod ?? "—",
    it.name,
    it.variant ?? it.presentation ?? "—",
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
        styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak", lineColor: [220, 220, 220], lineWidth: 0.3, minCellHeight: 30 },
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
        columnStyles,
        theme: "grid",
        willDrawPage: () => {
          // Paint background BEFORE the table content on each new page so
          // rows remain visible. Guarded to run once per page.
          drawPageChrome();
        },
        didDrawCell: (data) => {
          if (data.section !== "body" || data.column.index !== 0) return;
          const it = sub.rows[data.row.index];
          if (!it) return;
          const entry = imgs.get(it.id);
          if (!entry) return;
          const pad = 2;
          const size = Math.min(data.cell.width, data.cell.height) - pad * 2;
          const x = data.cell.x + (data.cell.width - size) / 2;
          const y = data.cell.y + (data.cell.height - size) / 2;
          const fmt = entry.mime.includes("jpeg") || entry.mime.includes("jpg") ? "JPEG" : "PNG";
          try {
            doc.addImage(entry.dataUrl, fmt, x, y, size, size, undefined, "FAST");
          } catch {
            /* skip broken image */
          }
        },
      });
      cursorY = ((doc as any).lastAutoTable?.finalY ?? cursorY) + 4;
    }
  }

  // Footer totals: Preço de tabela / Valor de desconto / Preço Dealer
  const totalTabela = items.reduce((a, b) => a + Number(b.price_base || 0), 0);
  const totalDealer = items.reduce((a, b) => a + Number(b.price_dealer || 0), 0);
  const totalDesc = totalTabela - totalDealer;
  const descPct = totalTabela > 0 ? (totalDesc / totalTabela) * 100 : 0;
  ensureSpace(72);
  const boxX = pageW - rightMargin - 240;
  const boxY = cursorY + 6;
  doc.setDrawColor(200);
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(boxX, boxY, 240, 60, 4, 4, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Preço de tabela:", boxX + 10, boxY + 16);
  doc.text("Valor de desconto:", boxX + 10, boxY + 32);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Preço Dealer:", boxX + 10, boxY + 51);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(formatMoney(totalTabela, currency), boxX + 230, boxY + 16, { align: "right" });
  doc.text(`${formatMoney(totalDesc, currency)} (${descPct.toFixed(1)}%)`, boxX + 230, boxY + 32, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(formatMoney(totalDealer, currency), boxX + 230, boxY + 51, { align: "right" });

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

  // Landscape A4 content width = 16838 - 2*1000 = 14838 DXA. Use full width.
  const widths = [1000, 3600, 1800, 1400, 1800, 900, 1400, 1000, 1938]; // sums to 14838
  const totalW = widths.reduce((a, b) => a + b, 0);
  const colCount = widths.length;
  const headers = ["COD", "Produto", "Variante", "NCM/HS", "GTIN/EAN", "Unid", "Preço", "Desc.", "Preço dealer"];

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders, width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: "374151", type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })],
    })),
  });

  const bandRow = (label: string, dark: boolean) => new TableRow({
    children: [new TableCell({
      borders,
      width: { size: totalW, type: WidthType.DXA },
      columnSpan: colCount,
      shading: { fill: dark ? "1F1F1F" : "E5E5E5", type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({
        text: dark ? label.toUpperCase() : label,
        bold: true,
        color: dark ? "FFFFFF" : "1F1F1F",
        size: dark ? 22 : 20,
      })] })],
    })],
  });

  const itemRow = (it: DealerPriceItem) => new TableRow({
    children: [
      it.cod ?? "—",
      it.name,
      it.variant ?? it.presentation ?? "—",
      it.ncm_hs ?? "—",
      it.gtin_ean ?? "—",
      it.quantity_multiplier != null ? String(it.quantity_multiplier) : (it.unidade ?? "1"),
      formatMoney(it.price_base, currency),
      `${Number(it.discount_pct).toFixed(1)}%`,
      formatMoney(it.price_dealer, currency),
    ].map((val, i) => new TableCell({
      borders, width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({
        children: [new TextRun({ text: String(val), size: 18, bold: i === colCount - 1 })],
        alignment: i >= 5 ? AlignmentType.RIGHT : AlignmentType.LEFT,
      })],
    })),
  });

  // Build category-separated rows.
  const groups = groupItemsByCategory(items);
  const rows: TableRow[] = [headerRow];
  for (const grp of groups) {
    rows.push(bandRow(grp.category, true));
    for (const sub of grp.subs) {
      if (grp.subs.length > 1 || sub.subcategory !== "Geral") {
        rows.push(bandRow(sub.subcategory, false));
      }
      for (const it of sub.rows) rows.push(itemRow(it));
    }
  }

  const table = new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });

  const total = items.reduce((a, b) => a + Number(b.price_dealer || 0), 0);

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
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Total dealer: ${formatMoney(total, currency)}`, bold: true, size: 22 })] }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "WWW.SMARTDENT.COM.BR", bold: true })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileBase(distributor, list, filenamePrefix)}.docx`);
}