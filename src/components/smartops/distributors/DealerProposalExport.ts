import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType } from "docx";
import { saveAs } from "file-saver";
import type { DealerPriceItem, DealerPriceList, Distributor } from "./types";
import { formatMoney } from "./types";

function fileBase(distributor: Distributor | undefined, list: DealerPriceList | null, prefix = "tabela-preco") {
  const dist = (distributor?.nome_fantasia || distributor?.razao_social || "distribuidor").replace(/\W+/g, "-").toLowerCase();
  const ts = new Date().toISOString().slice(0, 10);
  return `${prefix}-${dist}-v${list?.version ?? 1}-${ts}`;
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
export function exportPriceTablePdf(
  distributor: Distributor | undefined,
  list: DealerPriceList | null,
  items: DealerPriceItem[],
  opts: { title?: string; filenamePrefix?: string } = {},
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const currency = list?.currency ?? "BRL";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SMART DENT", 40, 45);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Smart Dent BR — São Carlos, SP  ·  Smart Dent USA — Charlotte, NC", 40, 62);
  doc.text("FDA · ISO 13485:2016 · ANSM · TrinovaBiochem", 40, 76);

  doc.setFontSize(10);
  const infoY = 100;
  doc.text(`Empresa: ${distributor?.nome_fantasia ?? "—"}`, 40, infoY);
  doc.text(`Razão Social: ${distributor?.razao_social ?? "—"}`, 320, infoY);
  doc.text(`Contato: ${distributor?.buyer_name ?? distributor?.owner_name ?? "—"}`, 40, infoY + 14);
  doc.text(`E-mail: ${distributor?.buyer_email ?? distributor?.owner_email ?? "—"}`, 320, infoY + 14);
  doc.text(`País: ${distributor?.pais ?? "—"}`, 40, infoY + 28);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}  ·  Versão: v${list?.version ?? 1}`, 320, infoY + 28);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title ?? "Price Table", 40, infoY + 60);

  autoTable(doc, {
    startY: infoY + 70,
    head: [["COD", "Produto", "Variante", "GTIN/EAN", "NCM/HS", "Preço", "Desc.", "Preço dealer"]],
    body: items.map((it) => [
      it.cod ?? "—",
      it.name,
      it.variant ?? "—",
      it.gtin_ean ?? "—",
      it.ncm_hs ?? "—",
      formatMoney(it.price_base, currency),
      `${Number(it.discount_pct).toFixed(1)}%`,
      formatMoney(it.price_dealer, currency),
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" } },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? infoY + 200;
  const total = items.reduce((a, b) => a + Number(b.price_dealer || 0), 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Total dealer: ${formatMoney(total, currency)}`, doc.internal.pageSize.getWidth() - 40, finalY + 24, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("WWW.SMARTDENT.COM.BR", doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });

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