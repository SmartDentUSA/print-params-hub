// TEMPORÁRIO: valida a rota de upload resumível ao Google Drive. Será removido.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { driveStartResumableUpload, driveUploadChunk, driveListNames } from "../_shared/drive.ts";


serve(async () => {
  try {
    const folderId = "1nTTLOCxP5vYjGzQlX5ipFoqvyNgaX24L"; // 154 / fotos_turma
    const existing = await driveListNames("gateway", folderId);
    const prefix = "T154_TESTE_UPLOAD_DESCARTAVEL_GERAL_FOTO_TURMA";
    let max = 0;
    for (const n of existing) {
      const m = n.match(new RegExp(`^${prefix}_(\\d{3,})\\.`));
      if (m) max = Math.max(max, Number(m[1]));
    }
    const filename = `${prefix}_${String(max + 1).padStart(3, "0")}.png`;
    const bytes = new TextEncoder().encode("arquivo de teste descartavel - lovable\n".repeat(20));
    const session = await driveStartResumableUpload("gateway", folderId, filename, "image/png", bytes.byteLength);
    const res = await driveUploadChunk(session, bytes, 0, bytes.byteLength);
    return new Response(JSON.stringify({ ok: true, filename, existing_count: existing.length, res }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
