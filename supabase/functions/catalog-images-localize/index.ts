// One-off, admin-only: copies resin images hosted outside this project's storage
// (System A product-images bucket and Loja Integrada CDN) into our public buckets
// and repoints image_url. Only rows still pointing to the external URL are updated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 1), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const EXT: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("is_admin", { user_id: u.user.id });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const { data: cat, error: e1 } = await admin.from("system_a_catalog")
    .select("id,name,image_url,og_image_url")
    .eq("active", true).eq("approved", true).eq("visible_in_ui", true)
    .ilike("name", "%resina%").like("image_url", "%pgfgripuanuwwolmtknn%");
  const { data: res, error: e2 } = await admin.from("resins")
    .select("id,name,image_url").eq("active", true).like("image_url", "%awsli%");
  if (e1 || e2) return json({ error: (e1 ?? e2)!.message }, 500);

  const jobs = [
    ...(cat ?? []).map((r) => ({ r, table: "system_a_catalog", bucket: "catalog-images", folder: "products" })),
    ...(res ?? []).map((r) => ({ r, table: "resins", bucket: "model-images", folder: "models" })),
  ];
  const out: unknown[] = [];
  for (const { r, table, bucket, folder } of jobs) {
    const old = r.image_url as string;
    try {
      const dl = await fetch(old);
      if (!dl.ok) { out.push({ id: r.id, name: r.name, error: `download ${dl.status}` }); continue; }
      const bytes = new Uint8Array(await dl.arrayBuffer());
      const ct = (dl.headers.get("content-type") ?? "image/jpeg").split(";")[0];
      const ext = EXT[ct] ?? old.split("?")[0].split(".").pop()!.toLowerCase();
      const path = `${folder}/${slug(r.name)}-${String(r.id).slice(0, 8)}.${ext}`;
      const pub = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      if (dry) { out.push({ id: r.id, name: r.name, table, old, new: pub, bytes: bytes.length }); continue; }
      const { error: upErr } = await admin.storage.from(bucket)
        .upload(path, bytes, { contentType: ct, upsert: true, cacheControl: "31536000" });
      if (upErr) { out.push({ id: r.id, name: r.name, error: `upload ${upErr.message}` }); continue; }
      const chk = await fetch(pub);
      const chkLen = (await chk.arrayBuffer()).byteLength;
      if (!chk.ok || chkLen !== bytes.length) { out.push({ id: r.id, name: r.name, error: `verify ${chk.status}` }); continue; }
      const patch: Record<string, string> = { image_url: pub };
      if ((r as { og_image_url?: string }).og_image_url === old) patch.og_image_url = pub;
      const { data: upd, error: uErr } = await admin.from(table).update(patch).eq("id", r.id).eq("image_url", old).select("id");
      if (uErr || !upd?.length) { out.push({ id: r.id, name: r.name, error: `update ${uErr?.message ?? "no row"}` }); continue; }
      out.push({ id: r.id, name: r.name, table, old, new: pub, bytes: bytes.length });
    } catch (e) {
      out.push({ id: r.id, name: r.name, error: String(e) });
    }
  }
  const failed = out.filter((o) => (o as { error?: string }).error);
  return json({ dry, total: jobs.length, ok: jobs.length - failed.length, failed: failed.length, items: out });
});
