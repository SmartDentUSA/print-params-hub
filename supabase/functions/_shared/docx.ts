// Gerador mínimo de .docx (OOXML) sem dependências pesadas: monta o pacote ZIP
// com JSZip e escreve apenas parágrafos de texto (com negrito opcional).
import JSZip from "https://esm.sh/jszip@3.10.1";

export interface DocxParagraph {
  text: string;
  bold?: boolean;
  heading?: boolean;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paragraphXml(p: DocxParagraph): string {
  const bold = p.bold || p.heading ? "<w:b/>" : "";
  const size = p.heading ? '<w:sz w:val="32"/>' : "";
  const lines = String(p.text ?? "").split("\n");
  const runs = lines
    .map((line, i) =>
      `${i > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(line)}</w:t>`,
    )
    .join("");
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr>${bold}${size}</w:rPr>${runs}</w:r></w:p>`;
}

export async function buildSimpleDocx(paragraphs: DocxParagraph[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  const body = paragraphs.map(paragraphXml).join("");
  zip.folder("word")!.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`,
  );
  const out = await zip.generateAsync({ type: "uint8array" });
  return out as Uint8Array;
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
