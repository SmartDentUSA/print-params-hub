import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PromotionalSectionWithItems, PromotionalTable } from "./promotionalTypes";
import { itemTotals } from "./promotionalTypes";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value || 0);

const date = (value: string | null) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
  : "—";

export async function exportPromotionalPdf(
  table: PromotionalTable,
  sections: PromotionalSectionWithItems[],
  distributorName?: string,
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
  if (table.notes) {
    doc.setTextColor(70, 70, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(table.notes, width - margin * 2), margin, y + 116);
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
  doc.save(`tabela-promocional-${filename || "smart-dent"}.pdf`);
}