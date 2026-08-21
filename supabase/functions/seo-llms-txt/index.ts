// ═══════════════════════════════════════════════════════════
// 📄 /llms.txt (mirror para Vercel) — Smart Dent v2.3
// Servido em https://parametros.smartdent.com.br/llms.txt
// Conteúdo e handler centralizados em _shared/llms-identity.ts
// (compartilhado com llms-txt — mesma rota, dois caminhos de deploy)
// ═══════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { llmsTxtHandler } from "../_shared/llms-identity.ts";

serve(llmsTxtHandler);
