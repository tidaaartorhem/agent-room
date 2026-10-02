import { GoogleAuth } from "google-auth-library";
import { CONFIG } from "./config";

let auth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!auth) auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
  return auth;
}

export interface ModelResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export class ModelError extends Error {
  transient: boolean;
  status: number;
  constructor(status: number, msg: string, transient: boolean) {
    super(msg);
    this.status = status;
    this.transient = transient;
  }
}

/**
 * Vertex AI adapter (provider: Google Cloud, self-reported label "vertex-ai").
 * No API keys: authenticates as the backend service account via ADC.
 */
export async function generateContent(opts: {
  systemPrompt: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<ModelResult> {
  const client = await getAuth().getClient();
  const tok = await client.getAccessToken();
  if (!tok.token) throw new ModelError(500, "no access token", true);
  const url =
    `https://${CONFIG.vertexLocation}-aiplatform.googleapis.com/v1` +
    `/projects/${CONFIG.projectId}/locations/${CONFIG.vertexLocation}` +
    `/publishers/google/models/${CONFIG.vertexModel}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        maxOutputTokens: opts.maxOutputTokens ?? CONFIG.maxOutputTokensPerTurn,
        temperature: opts.temperature ?? 0.7,
        // Disable thinking: v0.1 wants fast, cheap, predictable turns.
        // Thinking tokens would eat the small per-turn budget.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: opts.signal ?? AbortSignal.timeout(CONFIG.turnTimeoutMs),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new ModelError(res.status, `vertex ${res.status}: ${body}`, res.status >= 500 || res.status === 429);
  }
  const d = await res.json();
  const text = (d.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  const u = d.usageMetadata ?? {};
  return {
    text,
    inputTokens: u.promptTokenCount ?? 0,
    outputTokens: u.candidatesTokenCount ?? 0,
  };
}
