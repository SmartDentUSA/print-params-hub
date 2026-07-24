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
  const currency = list?.currency ?? "BRL";
  const header = [
    "Categoria", "Subcategoria", "SKU", "Produto",
    "NCM", "GTIN", "Variante", "Pres", "Cor", "Qtd",
    "Preço unitário", "Desc %", `Desc (${currency})`, "Total",
  ];
  const aoa: any[][] = [header];
  const groups = groupItemsByCategory(items);
  for (const grp of groups) {
    for (const sub of grp.subs) {
      for (const it of sub.rows) {
        const row = aoa.length + 1; // 1-based, header on row 1
        aoa.push([
          grp.category, sub.subcategory,
          (it as any).sku ?? it.cod ?? "", it.name,
          it.ncm_hs ?? "", it.gtin_ean ?? "",
          it.variant ?? it.presentation_qty ?? "",
          (it.presentation as string) ?? "Unit",
          (it as any).color ?? "",
          Number(it.quantity_multiplier ?? 1) || 1,
          Number(it.price_base) || 0,
          Number(it.discount_pct) || 0,
          { f: `ROUND(K${row}*L${row}/100,2)` },        // Desc (currency) — col K=Preço, L=Desc%
          { f: `ROUND((K${row}-K${row}*L${row}/100)*J${row},2)` }, // Total — J=Qtd
        ]);
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 34 }, { wch: 26 }, { wch: 10 }, { wch: 40 },
    { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 8 },
    { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 },
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
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 841.89 (landscape)
  const pageH = doc.internal.pageSize.getHeight();  // 595.28
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

  // Table area: header block ends around y=210 — start table below.
  const tableTop = 224;
  const tableBottom = pageH - 70;
  const leftMargin = 28;
  const rightMargin = 28;
  const contentW = pageW - leftMargin - rightMargin;

  // 13-column layout: Foto | SKU | Produto | NCM | GTIN | Variante | Pres | Cor | Qtd | Preço unitário | Desc % | Desc (curr) | Total
  const head = [[
    "Foto", "SKU", "Produto", "NCM", "GTIN", "Variante", "Pres", "Cor",
    "Qtd", "Preço unitário", "Desc %", `Desc (${currency})`, "Total",
  ]];
  // Landscape contentW ≈ 786pt. Sum below = 786.
  const columnStyles: Record<number, any> = {
    0:  { cellWidth: 34, halign: "center" },   // Foto
    1:  { cellWidth: 60 },                      // SKU
    2:  { cellWidth: 150 },                     // Produto
    3:  { cellWidth: 50 },                      // NCM
    4:  { cellWidth: 60 },                      // GTIN
    5:  { cellWidth: 54 },                      // Variante
    6:  { cellWidth: 34 },                      // Pres
    7:  { cellWidth: 60 },                      // Cor
    8:  { cellWidth: 30, halign: "right" },     // Qtd
    9:  { cellWidth: 60, halign: "right" },     // Preço unitário
    10: { cellWidth: 40, halign: "right" },     // Desc %
    11: { cellWidth: 64, halign: "right" },     // Desc (curr)
    12: { cellWidth: 90, halign: "right", fontStyle: "bold" }, // Total
  };

  // Group by catalog_product_id to compute rowSpan on Foto/COD/Produto,
  // matching the on-screen grouping so variations of the same product share
  // photo/code/name across multiple rows.
  const groupKeyFor = (it: DealerPriceItem) =>
    it.catalog_product_id ? `cid:${it.catalog_product_id}` : `id:${it.id}`;

  const rowFor = (it: DealerPriceItem, isLeader: boolean, span: number) => {
    const qty = Number(it.quantity_multiplier ?? 1) || 1;
    const descAbs = (Number(it.price_base || 0) - Number(it.price_dealer || 0)) * qty;
    const lineTotal = Number(it.price_dealer || 0) * qty;
    const photo = isLeader ? { content: "", rowSpan: span } : null;
    const sku   = isLeader ? { content: (it as any).sku ?? it.cod ?? "—", rowSpan: span } : null;
    const nome  = isLeader ? { content: it.name, rowSpan: span } : null;
    const cells: any[] = [
      it.ncm_hs ?? "—",
      it.gtin_ean ?? "—",
      it.variant ?? it.presentation_qty ?? "—",
      (it.presentation as string) ?? "Unit",
      (it as any).color ?? "—",
      String(qty),
      formatMoney(it.price_base, currency),
      `${Number(it.discount_pct).toFixed(1)}%`,
      formatMoney(descAbs, currency),
      formatMoney(lineTotal, currency),
    ];
    return isLeader ? [photo, sku, nome, ...cells] : cells;
  };

  const orderRowsForRowSpan = (rows: DealerPriceItem[]) => {
    const firstIndex = new Map<string, number>();
    rows.forEach((r, i) => {
      const k = groupKeyFor(r);
      if (!firstIndex.has(k)) firstIndex.set(k, i);
    });
    const ordered = [...rows].sort((a, b) => {
      const ia = firstIndex.get(groupKeyFor(a))!;
      const ib = firstIndex.get(groupKeyFor(b))!;
      if (ia !== ib) return ia - ib;
      return rows.indexOf(a) - rows.indexOf(b);
    });
    const sizes = new Map<string, number>();
    for (const r of ordered) sizes.set(groupKeyFor(r), (sizes.get(groupKeyFor(r)) ?? 0) + 1);
    const seenLeader = new Set<string>();
    return ordered.map((r) => {
      const k = groupKeyFor(r);
      const isLeader = !seenLeader.has(k);
      seenLeader.add(k);
      return { it: r, isLeader, span: sizes.get(k)! };
    });
  };

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
      const bodyRows = orderRowsForRowSpan(sub.rows);
      const orderedItems = bodyRows.map((b) => b.it);
      autoTable(doc, {
        startY: cursorY,
        margin: { top: tableTop, bottom: pageH - tableBottom, left: leftMargin, right: rightMargin },
        head,
        body: bodyRows.map(({ it, isLeader, span }) => rowFor(it, isLeader, span)),
        styles: { fontSize: 7, cellPadding: 2.5, overflow: "linebreak", lineColor: [220, 220, 220], lineWidth: 0.3, minCellHeight: 26, valign: "middle" },
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontSize: 7, fontStyle: "bold" },
        columnStyles,
        theme: "grid",
        willDrawPage: () => {
          // Paint background BEFORE the table content on each new page so
          // rows remain visible. Guarded to run once per page.
          drawPageChrome();
        },
        didDrawCell: (data) => {
          if (data.section !== "body" || data.column.index !== 0) return;
          const it = orderedItems[data.row.index];
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

  // Footer totals — use line totals (price × quantity_multiplier) to match the UI.
  const totalTabela = items.reduce(
    (a, b) => a + Number(b.price_base || 0) * Number(b.quantity_multiplier ?? 1),
    0,
  );
  const totalDealer = items.reduce(
    (a, b) => a + Number(b.price_dealer || 0) * Number(b.quantity_multiplier ?? 1),
    0,
  );
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
  const imgs = await preloadImages(items);

  // Landscape A4 content width = 16838 - 2*1000 = 14838 DXA. 11 columns.
  const widths = [1000, 1400, 2900, 1200, 800, 1400, 700, 1400, 900, 1400, 1738]; // sum = 14838
  const totalW = widths.reduce((a, b) => a + b, 0);
  const colCount = widths.length;
  const headers = [
    "Foto", "SKU", "Produto", "Variante", "Pres", "Cor",
    "Qtd", "Preço unitário", "Desc %", `Desc (${currency})`, "Total",
  ];

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

  const itemRow = (it: DealerPriceItem) => {
    const qty = Number(it.quantity_multiplier ?? 1) || 1;
    const descAbs = (Number(it.price_base || 0) - Number(it.price_dealer || 0)) * qty;
    const lineTotal = Number(it.price_dealer || 0) * qty;
    const values: string[] = [
      "", // photo
      (it as any).sku ?? it.cod ?? "—",
      it.name,
      it.variant ?? it.presentation_qty ?? "—",
      (it.presentation as string) ?? "Unit",
      (it as any).color ?? "—",
      String(qty),
      formatMoney(it.price_base, currency),
      `${Number(it.discount_pct).toFixed(1)}%`,
      formatMoney(descAbs, currency),
      formatMoney(lineTotal, currency),
    ];
    return new TableRow({
      children: values.map((val, i) => {
        // Photo column
        if (i === 0) {
          const entry = imgs.get(it.id);
          let children: any[] = [new Paragraph({ children: [new TextRun("")] })];
          if (entry) {
            const type = entry.mime.includes("jpeg") || entry.mime.includes("jpg") ? "jpg"
              : entry.mime.includes("png") ? "png"
              : entry.mime.includes("gif") ? "gif"
              : "png";
            try {
              children = [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({
                  type: type as any,
                  data: entry.bytes,
                  transformation: { width: 60, height: 60 },
                  altText: { title: it.name, description: it.name, name: it.name },
                })],
              })];
            } catch { /* leave empty */ }
          }
          return new TableCell({
            borders, width: { size: widths[i], type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            children,
          });
        }
        return new TableCell({
          borders, width: { size: widths[i], type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({
            children: [new TextRun({ text: String(val), size: 18, bold: i === colCount - 1 })],
            alignment: i >= 6 ? AlignmentType.RIGHT : AlignmentType.LEFT,
          })],
        });
      }),
    });
  };

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

  const totalTabela = items.reduce(
    (a, b) => a + Number(b.price_base || 0) * Number(b.quantity_multiplier ?? 1),
    0,
  );
  const totalDealer = items.reduce(
    (a, b) => a + Number(b.price_dealer || 0) * Number(b.quantity_multiplier ?? 1),
    0,
  );
  const totalDesc = totalTabela - totalDealer;
  const descPct = totalTabela > 0 ? (totalDesc / totalTabela) * 100 : 0;

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
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Preço de tabela: ${formatMoney(totalTabela, currency)}`, size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Valor de desconto: ${formatMoney(totalDesc, currency)} (${descPct.toFixed(1)}%)`, size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Preço Dealer: ${formatMoney(totalDealer, currency)}`, bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "WWW.SMARTDENT.COM.BR", bold: true })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileBase(distributor, list, filenamePrefix)}.docx`);
}