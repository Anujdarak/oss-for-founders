/**
 * One interface over Gemini, Groq and OpenRouter.
 *
 * Server-only by construction: the key is read from `LLM_API_KEY`, which has
 * no `NEXT_PUBLIC_` prefix and therefore is never inlined into client code.
 * The guard below is belt and braces — if this module is ever imported from a
 * component that runs in the browser, it fails loudly instead of quietly
 * shipping a key.
 */
if (typeof window !== "undefined") {
  throw new Error("lib/assistant/llm is server-only and must never be imported by a client component")
}

// "grok" is xAI (api.x.ai). "groq" is Groq Cloud (api.groq.com). Different
// companies, one letter apart, and both are supported — mixing them up is
// the easiest mistake to make here, so they are listed adjacent on purpose.
export type Provider = "gemini" | "grok" | "groq" | "openrouter"

export type LlmConfig = {
  provider: Provider
  apiKey: string
  model: string
}

/**
 * Default models, chosen by probing a real key rather than from memory.
 *
 * The first default here was `gemini-2.0-flash`, which the API now answers
 * with a 404: "no longer available". Model names age out, and the failure
 * mode is miserable — the request fails, the pipeline falls back, and the
 * answer still looks fine, so nothing tells you the key is doing nothing.
 *
 * Probe results against a free-tier key, November 2026:
 *   gemini-flash-lite-latest  1.2-3.1s, answered every time   <- chosen
 *   gemini-3.5-flash          4.3-5.1s when it worked, 503 about half the time
 *   gemini-3-flash-preview    2.4s once, then 503
 *   gemini-flash-latest       503 repeatedly, "high demand"
 *   gemini-3.8-flash          429, not on the free tier
 *   gemini-3.1-flash-lite     43s, far past any sane timeout
 *   gemini-2.5-flash          404, "no longer available to new users"
 *
 * Lite is the default on reliability, not speed. The bigger flash models
 * returned 503 often enough on a free-tier key that the assistant spent most
 * of its time timing out and falling back, and neither task here is hard
 * reasoning — decomposition into needs, then picking 3 of 40 candidates and
 * writing a sentence from supplied fields. Side by side on three real
 * questions the decompositions were comparable.
 *
 * Two traps worth naming. A pinned version ages out: the first default here
 * was `gemini-2.0-flash`, now a 404. And the `-latest` aliases are not the
 * safe answer they look like — `gemini-flash-latest` points at whatever is
 * newest, which is also whatever is most contended, and it 503'd every time.
 * `gemini-flash-lite-latest` is the alias to a tier nobody is stampeding.
 *
 * The OpenRouter default is still unverified — no key for it. If it 404s,
 * set OPENROUTER_MODEL to a current name; the server log says what came back.
 */
const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-flash-lite-latest",
  // xAI. Unverified — no key to probe with at the time of writing, and the
  // Gemini default taught us that a guessed model name ages into a 404. If
  // this 404s, set GROK_MODEL from GET https://api.x.ai/v1/models; the server
  // log prints exactly what came back.
  grok: "grok-3",
  // Probed against a real Groq key. The previous default here,
  // "llama-3.3-70b-versatile", is retired and no longer in their model list
  // -- the same way the first Gemini default aged into a 404. Measured on
  // the real understand prompt:
  //   openai/gpt-oss-120b  1.2-1.5s, best decompositions  <- chosen
  //   openai/gpt-oss-20b   1.0-1.3s
  //   qwen/qwen3.8-27b     0.5-0.6s, fastest, slightly looser needs
  // All three are faster than Gemini and all honour JSON mode.
  groq: "openai/gpt-oss-120b",
  openrouter: "google/gemini-2.0-flash-001",
}

/** Per-provider key, checked before the legacy single-key variables. */
const KEY_VARS: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  grok: "GROK_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
}

const MODEL_VARS: Record<Provider, string> = {
  gemini: "GEMINI_MODEL",
  grok: "GROK_MODEL",
  groq: "GROQ_MODEL",
  openrouter: "OPENROUTER_MODEL",
}

const PROVIDERS: Provider[] = ["gemini", "grok", "groq", "openrouter"]

function asProvider(raw: string | undefined): Provider | null {
  const value = raw?.trim().toLowerCase()
  return PROVIDERS.includes(value as Provider) ? (value as Provider) : null
}

/**
 * Every provider that has a key, in a stable order.
 *
 * Two ways to configure, and both work at once:
 *
 * - Per provider: `GEMINI_API_KEY`, `GROK_API_KEY`, `GROQ_API_KEY`,
 *   `OPENROUTER_API_KEY`. Set two or more and requests rotate between them.
 * - The original single pair, `LLM_PROVIDER` + `LLM_API_KEY`, which is what
 *   is deployed today. It is kept because it is live: dropping it would have
 *   silently turned the running site back to the keyless engine.
 *
 * A provider named by both wins from the specific variable.
 */
export function getLlmConfigs(): LlmConfig[] {
  const configs = new Map<Provider, LlmConfig>()

  for (const provider of PROVIDERS) {
    const apiKey = process.env[KEY_VARS[provider]]?.trim()
    if (!apiKey) continue
    configs.set(provider, {
      provider,
      apiKey,
      model: process.env[MODEL_VARS[provider]]?.trim() || DEFAULT_MODELS[provider],
    })
  }

  const legacyKey = process.env.LLM_API_KEY?.trim()
  if (legacyKey) {
    const provider = asProvider(process.env.LLM_PROVIDER) ?? "gemini"
    if (!configs.has(provider)) {
      configs.set(provider, {
        provider,
        apiKey: legacyKey,
        model:
          process.env[MODEL_VARS[provider]]?.trim() ||
          process.env.LLM_MODEL?.trim() ||
          DEFAULT_MODELS[provider],
      })
    }
  }

  return [...configs.values()]
}

/** The first configured provider, or null. Kept for callers that want one. */
export function getLlmConfig(): LlmConfig | null {
  return getLlmConfigs()[0] ?? null
}

/**
 * Round-robin cursor.
 *
 * Module scope, so it persists for the life of a server instance and resets
 * on a cold start. That is good enough for spreading load across free tiers
 * — the goal is not to alternate exactly, it is to stop one provider
 * absorbing every request and hitting its daily cap by lunchtime.
 */
let cursor = 0

/** Providers for this request, starting at the next one in the rotation. */
export function rotate(configs: LlmConfig[]): LlmConfig[] {
  if (configs.length <= 1) return configs
  const start = cursor % configs.length
  cursor = (cursor + 1) % configs.length
  return [...configs.slice(start), ...configs.slice(0, start)]
}

export class LlmError extends Error {}

/**
 * 12s was too short. The probe that picked the model used a two-word prompt
 * and came back in 2.5s; the real `understand` prompt is a page of
 * instructions and the real rerank prompt carries 40 candidates, and the
 * first live run aborted on the timeout rather than on anything being wrong.
 *
 * Then back down to 12s once the default became the lite model, which answers
 * in 1-3s. The timeout is no longer there to wait out a slow answer — it is
 * there to give up on a congested model quickly and try the next one.
 */
const TIMEOUT_MS = 12_000

/**
 * Models to fall through to when the primary is busy, in order.
 *
 * A plain retry is the wrong move for a 503 that says "this model is
 * experiencing high demand" — the second attempt queues behind the same
 * congestion. Dropping to a different model answers the question instead.
 *
 * The chain runs lite-first and climbs: the default is the reliable one, and
 * these are the heavier models to try if even lite is busy. That is the
 * opposite of the usual arrangement, and it is what the measurements
 * supported on a free-tier key.
 */
const FALLBACK_MODELS: Record<Provider, string[]> = {
  gemini: ["gemini-3.5-flash", "gemini-3-flash-preview"],
  grok: [],
  groq: ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
  openrouter: [],
}

/** Transient: worth another model or another go. */
function isRetryable(error: unknown): boolean {
  if (!(error instanceof LlmError)) return false
  return /\b(429|500|502|503|504)\b/.test(error.message)
}

/**
 * Ask for JSON and get a parsed object back, or throw.
 *
 * Every provider is asked for JSON mode where it exists, and the result is
 * still parsed defensively — JSON mode is a strong hint, not a guarantee, and
 * several models still wrap output in a ``` fence under load.
 */
export async function completeJson<T>(
  config: LlmConfig,
  system: string,
  user: string,
  signal?: AbortSignal
): Promise<T> {
  const models = [config.model, ...(FALLBACK_MODELS[config.provider] ?? [])]
  let lastError: unknown

  for (const model of models) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true })

    try {
      const text = await callProvider({ ...config, model }, system, user, controller.signal)
      return parseJson<T>(text)
    } catch (error) {
      lastError = error
      // A caller-cancelled request is not a provider problem: the reader
      // navigated away, and trying the next model wastes a call.
      if (signal?.aborted) throw error
      if (!isRetryable(error)) throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError instanceof Error ? lastError : new LlmError("every model failed")
}

/**
 * Ask the providers in rotation until one answers.
 *
 * Round robin and failover in one pass. The rotation spreads load so no
 * single free tier absorbs every request; the failover means a provider that
 * is rate-limited, down, or serving a retired model costs one attempt rather
 * than the whole answer. Both matter on free tiers, which is the only reason
 * more than one provider is configured.
 *
 * Returns which provider actually answered, so the caller can report it —
 * a silent fallback was the bug that made a dead Gemini key look healthy.
 */
export async function completeJsonAny<T>(
  configs: LlmConfig[],
  system: string,
  user: string,
  signal?: AbortSignal
): Promise<{ value: T; provider: Provider; triedBefore: Provider[] }> {
  const order = rotate(configs)
  const tried: Provider[] = []
  let lastError: unknown

  for (const config of order) {
    try {
      const value = await completeJson<T>(config, system, user, signal)
      return { value, provider: config.provider, triedBefore: tried }
    } catch (error) {
      lastError = error
      tried.push(config.provider)
      // The reader cancelled; trying another provider wastes a call.
      if (signal?.aborted) throw error
    }
  }

  throw lastError instanceof Error ? lastError : new LlmError("no provider answered")
}

async function callProvider(
  config: LlmConfig,
  system: string,
  user: string,
  signal: AbortSignal
): Promise<string> {
  if (config.provider === "gemini") {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(config.model)}:generateContent`
    const response = await fetch(url, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    })
    if (!response.ok) throw new LlmError(`gemini ${response.status}: ${await safeText(response)}`)
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("")
    if (!text) throw new LlmError("gemini returned no text")
    return text
  }

  // Groq and OpenRouter are both OpenAI-shaped.
  const OPENAI_SHAPED: Record<string, string> = {
    grok: "https://api.x.ai/v1/chat/completions",
    groq: "https://api.groq.com/openai/v1/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
  }
  const endpoint = OPENAI_SHAPED[config.provider]

  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  if (!response.ok) {
    throw new LlmError(`${config.provider} ${response.status}: ${await safeText(response)}`)
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = payload.choices?.[0]?.message?.content
  if (!text) throw new LlmError(`${config.provider} returned no text`)
  return text
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 200)
  } catch {
    return "(no body)"
  }
}

/** Tolerates a ``` fence and leading prose around the object. */
export function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim()
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T
    }
    throw new LlmError("response was not JSON")
  }
}
