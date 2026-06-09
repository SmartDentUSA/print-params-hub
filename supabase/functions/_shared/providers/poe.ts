// Poe.com adapter — OpenAI-compatible chat completions.
// Docs: https://creator.poe.com/docs/external-applications/openai-compatible-api

const POE_API_KEY = Deno.env.get("POE_API_KEY");

export interface PoeCallParams {
  model: string;                              // ex: "claude-opus-4.8", "gpt-5.5", "gemini-3-flash"
  messages: Array<{ role: string; content: any }>;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  temperature?: number;
  max_tokens?: number;
  stream?: false;                             // streaming não suportado nesta v1
}

export interface PoeCallResult {
  ok: boolean;
  status: number;
  text?: string;                              // mensagem assistant
  toolCalls?: any[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  raw?: any;
  error?: string;
}

export async function callPoe(params: PoeCallParams): Promise<PoeCallResult> {
  if (!POE_API_KEY) {
    return { ok: false, status: 0, error: "POE_API_KEY não configurada" };
  }

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: false,
  };
  if (params.tools) body.tools = params.tools;
  if (params.tool_choice) body.tool_choice = params.tool_choice;
  if (params.response_format) body.response_format = params.response_format;
  if (typeof params.temperature === "number") body.temperature = params.temperature;
  if (typeof params.max_tokens === "number") body.max_tokens = params.max_tokens;

  try {
    const resp = await fetch("https://api.poe.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${POE_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const txt = await resp.text();
    let parsed: any;
    try { parsed = JSON.parse(txt); } catch { parsed = null; }

    if (!resp.ok) {
      return { ok: false, status: resp.status, error: parsed?.error?.message || txt.slice(0, 500), raw: parsed };
    }

    const choice = parsed?.choices?.[0];
    const msg = choice?.message ?? {};
    return {
      ok: true,
      status: resp.status,
      text: typeof msg.content === "string" ? msg.content : (msg.content?.[0]?.text ?? ""),
      toolCalls: msg.tool_calls,
      usage: parsed?.usage
        ? {
            prompt_tokens: parsed.usage.prompt_tokens || 0,
            completion_tokens: parsed.usage.completion_tokens || 0,
            total_tokens: parsed.usage.total_tokens || 0,
          }
        : undefined,
      raw: parsed,
    };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || String(e) };
  }
}

export function isPoeAvailable(): boolean {
  return !!POE_API_KEY;
}