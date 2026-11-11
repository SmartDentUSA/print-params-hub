// Leituras e chamadas do navegador usadas pelos passos a passo do Social Publisher.
// Mesmas fontes das telas: catálogo/resinas, IA de legenda, envio de mídia,
// instâncias e grupos de Post Grupos e lives ativas. A gravação é sempre no servidor.
import { supabase } from "@/integrations/supabase/client";
import { uploadSocialMediaFile } from "@/hooks/social/useMediaUpload";
import { generateBulkCopy } from "@/lib/social/bulkCaption";
import type { BulkMedia } from "@/lib/social/bulkPlan";
import type { BulkCopyResult, SocialPostDeps, SocialProduct } from "@/lib/copilotSocialPostWizard";
import type { GroupInstance, GroupRef, LiveCourse, SocialGroupsDeps } from "@/lib/copilotSocialGroupsWizard";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
/** Arquivos enviados nesta sessão: permite extrair áudio/quadros dos vídeos no navegador. */
const fileByUrl = new Map<string, File>();

export async function uploadWizardFiles(files: File[]): Promise<{ items: BulkMedia[]; errors: string[] }> {
  const items: BulkMedia[] = [];
  const errors: string[] = [];
  for (const f of files) {
    if (f.type.startsWith("video/") && f.size > MAX_VIDEO_BYTES) { errors.push(`${f.name}: vídeo acima de 500 MB`); continue; }
    try {
      const m = await uploadSocialMediaFile(f);
      fileByUrl.set(m.url, f);
      items.push({ url: m.url, type: m.type as "image" | "video", path: m.path, width: m.width, height: m.height });
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { items, errors };
}

const like = (q: string) => `%${q.replace(/[%_,()]/g, " ").trim()}%`;

export const socialPostDeps: SocialPostDeps = {
  async searchProducts(q) {
    const [{ data: cat }, { data: res }] = await Promise.all([
      supabase.from("system_a_catalog").select("id,name,category,slug").eq("active", true).ilike("name", like(q)).order("name").limit(10),
      supabase.from("resins").select("id,name,manufacturer,slug,type").eq("active", true).or(`name.ilike.${like(q)},manufacturer.ilike.${like(q)}`).order("name").limit(10),
    ]);
    const out: SocialProduct[] = [
      ...((cat as any[]) || []).map((p) => ({ ref: `product:${p.id}`, name: p.name, slug: p.slug || "", category: p.category || "" })),
      ...((res as any[]) || []).map((r) => ({ ref: `resin:${r.id}`, name: `${r.manufacturer || ""} ${r.name}`.trim(), slug: r.slug || "", category: r.type ? `Resina ${r.type}` : "Resina" })),
    ];
    return out;
  },
  async generateCaption(input) {
    const { data, error } = await supabase.functions.invoke("social-caption-generator", {
      body: { ...input, platform: "instagram", language: "pt-BR" },
    });
    const d = (data || {}) as any;
    if (d.fallback) throw new Error(d.message || d.error || "IA indisponível");
    const serverMsg = d.error || (error as any)?.context?.responseJson?.message || (error as any)?.context?.responseJson?.error;
    if (serverMsg || error) throw new Error(String(serverMsg || error?.message));
    return { caption: d.caption || "", hashtags: d.hashtags || [], first_comment: d.first_comment || "" };
  },
  async generateBulkCopies(media, instructions, mentions, platform) {
    const out: BulkCopyResult[] = [];
    for (const m of media) {
      try {
        const copy = await generateBulkCopy({ media: m, file: fileByUrl.get(m.url), instructions, mentions, platform });
        out.push(copy.caption.trim() ? { ok: true, copy } : { ok: false, error: "IA não devolveu legenda" });
      } catch (e) {
        out.push({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return out;
  },
};

export const socialGroupsDeps: SocialGroupsDeps = {
  async loadInstances() {
    const { data } = await supabase.from("post_group_instance_config" as any).select("instance_name,enabled").order("instance_name");
    const rows = (data as any[]) || [];
    const counted = await Promise.all(rows.map(async (r): Promise<GroupInstance> => {
      const [t, g] = await Promise.all([
        supabase.from("post_group_targets" as any).select("id", { count: "exact", head: true }).eq("instance_name", r.instance_name),
        supabase.from("wa_groups" as any).select("id", { count: "exact", head: true }).eq("instance_name", r.instance_name).eq("ativo", true),
      ]);
      return { name: r.instance_name, enabled: !!r.enabled, targets: t.count ?? 0, available: g.count ?? 0 };
    }));
    return counted.filter((i) => i.available > 0 || i.targets > 0);
  },
  async targetIds(instance) {
    const { data } = await supabase.from("post_group_targets" as any).select("group_id").eq("instance_name", instance).limit(2000);
    return ((data as any[]) || []).map((r) => String(r.group_id));
  },
  async searchInstanceGroups(instance, q) {
    let query = supabase.from("wa_groups" as any).select("id,name,member_count").eq("instance_name", instance).eq("ativo", true);
    if (q.trim()) query = query.ilike("name", like(q));
    const { data } = await query.order("member_count", { ascending: false }).limit(300);
    return ((data as any[]) || []).map((g): GroupRef => ({ id: g.id, name: g.name || "(sem nome)", members: g.member_count ?? 0, instance }));
  },
  async loadTargetGroups() {
    const { data } = await supabase.from("v_post_group_targets_detail" as any).select("group_id,group_name,member_count,instance_name").limit(5000);
    const seen = new Set<string>();
    const out: GroupRef[] = [];
    for (const r of (data as any[]) || []) {
      if (!r.group_id || seen.has(r.group_id)) continue;
      seen.add(r.group_id);
      out.push({ id: r.group_id, name: r.group_name || "(sem nome)", members: r.member_count ?? 0, instance: r.instance_name || "" });
    }
    return out;
  },
  async loadLiveCourses() {
    const { data } = await supabase.from("smartops_courses").select("id,title,category,modality").eq("active", true).order("title");
    return ((data as any[]) || [])
      .filter((c) => /live|online/i.test(`${c.category || ""} ${c.modality || ""}`))
      .map((c): LiveCourse => ({ id: c.id, title: c.title, category: c.category || c.modality || "" }));
  },
};
