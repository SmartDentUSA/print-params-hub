// Criativos da campanha das tabelas promocionais (somente administradores).
// Cria a pasta da tabela no Google Drive (dentro da pasta-mãe da campanha),
// envia os arquivos para lá e guarda uma cópia no bucket wa-media para
// miniatura/download na Agenda sem exigir login no Drive.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { getDriveAccessToken, driveEnsureFolder, driveUploadFile, driveGetWebViewLink, driveTrashFile, sanitizeFolderName } from "../_shared/drive.ts";

const PARENT_FOLDER = "1za7m7FK1zzbncKw61Zz3D2fkx8RWdyFA";
const MAX_BYTES = 25 * 1024 * 1024;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ensure_folder"), table_id: z.string().uuid() }),
  z.object({ action: z.literal("list"), table_id: z.string().uuid() }),
  z.object({ action: z.literal("upload"), table_id: z.string().uuid(), file_name: z.string().min(1).max(200), mime_type: z.string().min(3).max(120), data_base64: z.string().min(10), description: z.string().max(2000).default("") }),
  z.object({ action: z.literal("update"), id: z.string().uuid(), description: z.string().max(2000) }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

async function ensureFolder(tableId: string) {
  const { data: t, error } = await sb.from("promotional_tables").select("id, name, drive_folder_id, drive_folder_url").eq("id", tableId).maybeSingle();
  if (error || !t) throw new Error("Tabela não encontrada");
  if (t.drive_folder_id) return t;
  const token = await getDriveAccessToken();
  const id = await driveEnsureFolder(token, PARENT_FOLDER, sanitizeFolderName(t.name || "Tabela promocional"));
  const url = `https://drive.google.com/drive/folders/${id}`;
  await sb.from("promotional_tables").update({ drive_folder_id: id, drive_folder_url: url }).eq("id", tableId);
  return { ...t, drive_folder_id: id, drive_folder_url: url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { data: u } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!u?.user) return json({ error: "Sessão inválida" }, 401);
    const { data: role } = await sb.from("user_roles").select("user_id").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Sem permissão: apenas administradores" }, 403);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
    const b = parsed.data;

    if (b.action === "ensure_folder") return json({ table: await ensureFolder(b.table_id) });
    if (b.action === "list") {
      const { data } = await sb.from("promotional_table_creatives").select("*").eq("promotional_table_id", b.table_id).order("sort_order").order("created_at");
      return json({ creatives: data ?? [] });
    }
    if (b.action === "upload") {
      const bytes = Uint8Array.from(atob(b.data_base64), (c) => c.charCodeAt(0));
      if (bytes.length > MAX_BYTES) return json({ error: "Arquivo acima de 25 MB" }, 400);
      const t = await ensureFolder(b.table_id);
      const token = await getDriveAccessToken();
      const fileId = await driveUploadFile({ token, folderId: t.drive_folder_id!, name: b.file_name, content: bytes, mimeType: b.mime_type });
      const driveUrl = await driveGetWebViewLink(token, fileId).catch(() => null);
      const ext = (b.file_name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `promo-creatives/${b.table_id}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from("wa-media").upload(path, bytes, { contentType: b.mime_type, cacheControl: "86400" });
      const storageUrl = up.error ? null : sb.storage.from("wa-media").getPublicUrl(path).data.publicUrl;
      const { count } = await sb.from("promotional_table_creatives").select("id", { count: "exact", head: true }).eq("promotional_table_id", b.table_id);
      const { data, error } = await sb.from("promotional_table_creatives").insert({
        promotional_table_id: b.table_id, drive_file_id: fileId, drive_url: driveUrl, file_name: b.file_name, mime_type: b.mime_type,
        storage_url: storageUrl, description: b.description, sort_order: count ?? 0, created_by: u.user.id,
      }).select("*").single();
      if (error) throw new Error(error.message);
      return json({ creative: data });
    }
    if (b.action === "update") {
      const { error } = await sb.from("promotional_table_creatives").update({ description: b.description }).eq("id", b.id);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }
    const { data: row } = await sb.from("promotional_table_creatives").select("drive_file_id").eq("id", b.id).maybeSingle();
    if (row?.drive_file_id) await driveTrashFile(await getDriveAccessToken(), row.drive_file_id).catch((e) => console.error("trash", e));
    await sb.from("promotional_table_creatives").delete().eq("id", b.id);
    return json({ ok: true });
  } catch (e) {
    console.error("promo-creatives", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
