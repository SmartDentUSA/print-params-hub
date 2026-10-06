// email-flow-track — registra aberturas (pixel) e cliques (redirect) das réguas de e-mail.
// GET ?e=<send_event_id>&t=o  → pixel 1x1
// GET ?e=<send_event_id>&t=c&u=<url> → registra clique e redireciona
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GIF = new Uint8Array([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,0xff,0xff,0xff,0x00,0x00,0x00,
  0x21,0xf9,0x04,0x01,0x00,0x00,0x00,0x00,0x2c,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,0x44,0x01,0x00,0x3b,
]);
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const e = url.searchParams.get("e") || "";
  const t = url.searchParams.get("t") || "o";
  const target = url.searchParams.get("u") || "";
  const safeTarget = /^https?:\/\//i.test(target) ? target : "https://smartdent.com.br";
  try {
    if (UUID.test(e)) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: sent } = await supabase.from("email_flow_events")
        .select("id, flow_id, enrollment_id, node_id").eq("id", e).eq("event_type", "email_sent").maybeSingle();
      if (sent) {
        const type = t === "c" ? "email_clicked" : "email_opened";
        if (type === "email_opened") {
          const { count } = await supabase.from("email_flow_events").select("id", { count: "exact", head: true })
            .eq("enrollment_id", sent.enrollment_id).eq("node_id", sent.node_id).eq("event_type", "email_opened");
          if ((count ?? 0) === 0) {
            await supabase.from("email_flow_events").insert({ flow_id: sent.flow_id, enrollment_id: sent.enrollment_id, node_id: sent.node_id, event_type: type, payload: { send_event_id: e } });
          }
        } else {
          await supabase.from("email_flow_events").insert({ flow_id: sent.flow_id, enrollment_id: sent.enrollment_id, node_id: sent.node_id, event_type: type, payload: { send_event_id: e, url: safeTarget } });
        }
      }
    }
  } catch (err) {
    console.error("[email-flow-track]", err);
  }
  if (t === "c") return Response.redirect(safeTarget, 302);
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
});
