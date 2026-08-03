// TEMPORÁRIO: valida a rota de upload resumível ao Google Drive. Será removido.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { driveStartResumableUpload, driveUploadChunk, driveListNames } from "../_shared/drive.ts";
import { buildGeneratedFilename, DESTINATIONS } from "../training-drive-media-upload/naming.ts";

serve(async () => {
  try {
    const folderId = "1nTTLOCxP5vYjGzQlX5ipFoqvyNgaX24L"; // 154 / fotos_turma
    const existing = await driveListNames("gateway", folderId);
    const { filename } = buildGeneratedFilename({
      turmaNumber: 154,
      courseTitle: "TESTE UPLOAD DESCARTAVEL",
      destination: DESTINATIONS["fotos_turma"],
      mimeType: "image/png",
    } as any, existing);
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
