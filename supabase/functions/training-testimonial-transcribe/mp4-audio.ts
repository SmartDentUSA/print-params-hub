/**
 * Extrai a faixa de áudio AAC de um MP4/MOV hospedado no Drive, sem baixar o
 * vídeo inteiro: lê o índice (moov) e busca por intervalo só os trechos de áudio.
 * Devolve frames ADTS (.aac), que a IA aceita como áudio.
 */
import { driveDownloadRange } from "../_shared/drive.ts";

type Box = { type: string; start: number; size: number; header: number };

function u32(b: Uint8Array, o: number) {
  return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
}
function u64(b: Uint8Array, o: number) {
  return u32(b, o) * 4294967296 + u32(b, o + 4);
}
function typeAt(b: Uint8Array, o: number) {
  return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
}

function children(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  let o = start;
  while (o + 8 <= end) {
    let size = u32(b, o);
    const type = typeAt(b, o + 4);
    let header = 8;
    if (size === 1) { size = u64(b, o + 8); header = 16; }
    else if (size === 0) size = end - o;
    if (size < header) break;
    out.push({ type, start: o, size, header });
    o += size;
  }
  return out;
}
const find = (b: Uint8Array, parent: Box, type: string) =>
  children(b, parent.start + parent.header, parent.start + parent.size).find((c) => c.type === type);

async function locateMoov(fileId: string, fileSize: number): Promise<Uint8Array> {
  let o = 0;
  while (o < fileSize) {
    const h = await driveDownloadRange(fileId, o, Math.min(o + 15, fileSize - 1));
    let size = u32(h, 0);
    const type = typeAt(h, 4);
    if (size === 1) size = u64(h, 8);
    else if (size === 0) size = fileSize - o;
    if (type === "moov") return await driveDownloadRange(fileId, o, o + size - 1);
    if (size < 8) break;
    o += size;
  }
  throw new Error("Índice do vídeo (moov) não encontrado");
}

/** Lê o descritor esds e devolve o AudioSpecificConfig. */
function parseAsc(b: Uint8Array, esds: Box) {
  let o = esds.start + esds.header + 4; // version/flags
  const end = esds.start + esds.size;
  const readLen = () => {
    let len = 0;
    for (let i = 0; i < 4; i++) { const c = b[o++]; len = (len << 7) | (c & 0x7f); if (!(c & 0x80)) break; }
    return len;
  };
  while (o < end) {
    const tag = b[o++];
    const len = readLen();
    if (tag === 0x03) { o += 2; const flags = b[o++]; if (flags & 0x80) o += 2; if (flags & 0x40) o += 1 + b[o]; if (flags & 0x20) o += 2; continue; }
    if (tag === 0x04) { o += 13; continue; }
    if (tag === 0x05) {
      const objType = b[o] >> 3;
      const freqIdx = ((b[o] & 0x07) << 1) | (b[o + 1] >> 7);
      const channels = (b[o + 1] >> 3) & 0x0f;
      return { objType, freqIdx, channels };
    }
    o += len;
  }
  throw new Error("Configuração de áudio AAC não encontrada");
}

export async function extractAacFromDriveMp4(fileId: string, fileSize: number): Promise<Uint8Array> {
  const moovBytes = await locateMoov(fileId, fileSize);
  const moov: Box = { type: "moov", start: 0, size: moovBytes.byteLength, header: 8 };
  const b = moovBytes;

  let stbl: Box | undefined;
  for (const trak of children(b, 8, b.byteLength).filter((c) => c.type === "trak")) {
    const mdia = find(b, trak, "mdia");
    const hdlr = mdia && find(b, mdia, "hdlr");
    if (hdlr && typeAt(b, hdlr.start + hdlr.header + 8) === "soun") {
      const minf = find(b, mdia!, "minf");
      stbl = minf && find(b, minf, "stbl");
      break;
    }
  }
  void moov;
  if (!stbl) throw new Error("O vídeo não tem faixa de áudio");

  const stsd = find(b, stbl, "stsd")!;
  const entry = children(b, stsd.start + stsd.header + 8, stsd.start + stsd.size)[0];
  if (!entry || entry.type !== "mp4a") throw new Error(`Áudio em formato não suportado (${entry?.type})`);
  // mp4a: 8 reservados+ref, 8 versão/rev/vendor, 4 canais/bits, 4 compressão/pacote, 4 taxa
  let mp4aChildStart = entry.start + entry.header + 28;
  const ver = (b[entry.start + entry.header + 8] << 8) | b[entry.start + entry.header + 9];
  if (ver === 1) mp4aChildStart += 16; else if (ver === 2) mp4aChildStart += 36;
  const esds = children(b, mp4aChildStart, entry.start + entry.size).find((c) => c.type === "esds")
    ?? (() => { // QuickTime: esds dentro de wave
      const wave = children(b, mp4aChildStart, entry.start + entry.size).find((c) => c.type === "wave");
      return wave ? children(b, wave.start + 8, wave.start + wave.size).find((c) => c.type === "esds") : undefined;
    })();
  if (!esds) throw new Error("Descritor de áudio (esds) não encontrado");
  const asc = parseAsc(b, esds);

  // Tamanhos das amostras
  const stsz = find(b, stbl, "stsz")!;
  const fixed = u32(b, stsz.start + stsz.header + 4);
  const count = u32(b, stsz.start + stsz.header + 8);
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) sizes.push(fixed || u32(b, stsz.start + stsz.header + 12 + i * 4));

  // Offsets dos chunks
  const stco = find(b, stbl, "stco") || find(b, stbl, "co64");
  if (!stco) throw new Error("Tabela de offsets do áudio ausente");
  const nChunks = u32(b, stco.start + stco.header + 4);
  const chunkOffsets: number[] = [];
  for (let i = 0; i < nChunks; i++) {
    const p = stco.start + stco.header + 8 + i * (stco.type === "co64" ? 8 : 4);
    chunkOffsets.push(stco.type === "co64" ? u64(b, p) : u32(b, p));
  }

  // Amostras por chunk
  const stsc = find(b, stbl, "stsc")!;
  const nEntries = u32(b, stsc.start + stsc.header + 4);
  const stscRows: Array<[number, number]> = [];
  for (let i = 0; i < nEntries; i++) {
    const p = stsc.start + stsc.header + 8 + i * 12;
    stscRows.push([u32(b, p), u32(b, p + 4)]);
  }
  const chunks: Array<{ offset: number; first: number; n: number; bytes: number }> = [];
  let sample = 0;
  for (let c = 0; c < nChunks; c++) {
    let per = stscRows[0][1];
    for (const [firstChunk, spc] of stscRows) if (c + 1 >= firstChunk) per = spc;
    let bytes = 0;
    for (let k = 0; k < per && sample + k < count; k++) bytes += sizes[sample + k];
    chunks.push({ offset: chunkOffsets[c], first: sample, n: per, bytes });
    sample += per;
  }

  // Agrupa chunks próximos (lacuna < 256 KB) em requisições de até 8 MB.
  const groups: Array<{ start: number; end: number; items: typeof chunks }> = [];
  for (const ch of chunks) {
    if (!ch.bytes) continue;
    const g = groups[groups.length - 1];
    if (g && ch.offset - g.end < 256 * 1024 && ch.offset + ch.bytes - g.start < 8 * 1024 * 1024) {
      g.end = ch.offset + ch.bytes; g.items.push(ch);
    } else groups.push({ start: ch.offset, end: ch.offset + ch.bytes, items: [ch] });
  }

  const profile = Math.max(0, Math.min(3, asc.objType - 1));
  const frames: Uint8Array[] = [];
  let total = 0;
  const CONC = 6;
  const results: Uint8Array[][] = new Array(groups.length);
  for (let i = 0; i < groups.length; i += CONC) {
    await Promise.all(groups.slice(i, i + CONC).map(async (g, j) => {
      const data = await driveDownloadRange(fileId, g.start, g.end - 1);
      const out: Uint8Array[] = [];
      for (const ch of g.items) {
        let p = ch.offset - g.start;
        for (let k = 0; k < ch.n && ch.first + k < count; k++) {
          const sz = sizes[ch.first + k];
          const len = sz + 7;
          const h = new Uint8Array(7);
          h[0] = 0xff; h[1] = 0xf1;
          h[2] = (profile << 6) | (asc.freqIdx << 2) | (asc.channels >> 2);
          h[3] = ((asc.channels & 3) << 6) | (len >> 11);
          h[4] = (len >> 3) & 0xff;
          h[5] = ((len & 7) << 5) | 0x1f;
          h[6] = 0xfc;
          out.push(h, data.subarray(p, p + sz));
          p += sz;
        }
      }
      results[i + j] = out;
    }));
  }
  for (const r of results) for (const f of r) { frames.push(f); total += f.byteLength; }
  const aac = new Uint8Array(total);
  let o = 0;
  for (const f of frames) { aac.set(f, o); o += f.byteLength; }
  return aac;
}

/** Divide um fluxo ADTS em partes de até maxBytes, respeitando as fronteiras dos frames. */
export function splitAdts(aac: Uint8Array, maxBytes: number): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0, o = 0;
  while (o + 7 <= aac.byteLength) {
    const len = ((aac[o + 3] & 3) << 11) | (aac[o + 4] << 3) | (aac[o + 5] >> 5);
    if (len < 7) break;
    if (o + len - start > maxBytes && o > start) { parts.push(aac.subarray(start, o)); start = o; }
    o += len;
  }
  if (o > start) parts.push(aac.subarray(start, Math.min(o, aac.byteLength)));
  return parts;
}
