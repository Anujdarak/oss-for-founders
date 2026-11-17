import { NextResponse } from "next/server"

import { answerFromPlan, understand, type Answer } from "@/lib/assistant/pipeline"
import { getLlmConfigs } from "@/lib/assistant/llm"

/**
 * The assistant endpoint.
 *
 * Server-side on purpose, and not only for the API key: retrieval reads the
 * embedding file and holds the whole catalogue in memory, neither of which
 * belongs in a browser. The key is read here via `getLlmConfig()` and never
 * leaves this process — no part of the response contains it, and the client
 * is told only which provider answered.
 *
 * There is deliberately no route segment config here. `cacheComponents`
 * rejects both `runtime` and `dynamic` outright — the dev server fails to
 * compile the route with either. Neither is needed: Node is the default
 * runtime, which is what the retriever's `node:fs` read requires, and a POST
 * handler is never prerendered.
 */

const MAX_MESSAGE = 500
const MAX_HISTORY = 6

// ---------------------------------------------------------------- rate limit

const WINDOW_MS = 60_000
const MAX_REQUESTS = 20
const hits = new Map<string, number[]>()

/**
 * Per-IP, in memory. This is per server instance, so on a horizontally
 * scaled deploy it is a speed bump rather than a guarantee — which is the
 * right trade for a free, keyless, read-only endpoint. A shared store would
 * mean adding infrastructure the project deliberately does not have.
 */
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)

  // Opportunistic sweep so the map cannot grow without bound.
  if (hits.size > 5_000) {
    for (const [key, times] of hits) {
      if (times.every((at) => now - at >= WINDOW_MS)) hits.delete(key)
    }
  }

  return recent.length > MAX_REQUESTS
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") ?? "local"
}

// --------------------------------------------------------------------- cache

const CACHE_TTL_MS = 10 * 60_000
const CACHE_MAX = 200
const cache = new Map<string, { at: number; answer: Answer }>()

function normalizeQuery(message: string, history: string[]): string {
  return [
    ...history.slice(-2).map((entry) => entry.toLowerCase().trim()),
    message.toLowerCase().trim().replace(/\s+/g, " ").replace(/[?!.]+$/, ""),
  ].join("|")
}

function readCache(key: string): Answer | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  // Refresh insertion order so the eviction below is roughly LRU.
  cache.delete(key)
  cache.set(key, entry)
  return entry.answer
}

function writeCache(key: string, answer: Answer): void {
  cache.set(key, { at: Date.now(), answer })
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

// --------------------------------------------------------------------- route

type Body = {
  message?: unknown
  history?: unknown
}

/**
 * Reject anything that is not a real JSON POST from a browser doing fetch().
 *
 * `application/json` cannot be sent by a plain cross-origin HTML form — it is
 * not one of the three form-encodable types — so requiring it forces any
 * cross-site caller through a CORS preflight, which this origin never
 * answers. Without the check, a hostile page could fire `text/plain` POSTs
 * carrying JSON with no preflight at all. It could not *read* the reply, so
 * nothing leaks, but it could burn the LLM quota from every visitor it gets,
 * which is the realistic abuse of a keyed endpoint.
 */
function wrongContentType(request: Request): boolean {
  const type = request.headers.get("content-type") ?? ""
  return !type.toLowerCase().split(";")[0].trim().startsWith("application/json")
}

/**
 * Cap the body before parsing it.
 *
 * `request.json()` buffers the whole payload first, so a single 100MB POST
 * is a memory spike on a server that otherwise never allocates per request.
 * Content-Length can be absent or a lie, so the byte count is checked again
 * against what actually arrived.
 */
const MAX_BODY_BYTES = 8 * 1024

async function readJsonBody(request: Request): Promise<Body | null> {
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null

  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null

  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
    return parsed as Body
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  if (wrongContentType(request)) {
    return NextResponse.json(
      { error: "Send application/json." },
      { status: 415, headers: { "cache-control": "no-store" } }
    )
  }

  const body = await readJsonBody(request)
  if (!body) {
    return NextResponse.json(
      { error: "Expected a small JSON object." },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : ""
  if (!message) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 })
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter((entry): entry is string => typeof entry === "string")
        .slice(-MAX_HISTORY)
        .map((entry) => entry.slice(0, MAX_MESSAGE))
    : []

  if (rateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: "That is a lot of questions at once. Try again in a minute." },
      { status: 429 }
    )
  }

  const cacheKey = normalizeQuery(message, history)
  const cached = readCache(cacheKey)

  const encoder = new TextEncoder()
  const configs = getLlmConfigs()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"))
      }

      try {
        if (cached) {
          send({ type: "answer", answer: cached, cached: true })
          controller.close()
          return
        }

        send({ type: "status", stage: "understanding" })

        const plan = await understand(message, history, configs, request.signal)

        // The needs are the first thing worth showing: they are the part of
        // the answer that proves the question was understood rather than
        // keyword-matched.
        send({
          type: "plan",
          goal: plan.goal,
          needs: plan.needs.map((need) => ({ key: need.key, label: need.label })),
        })

        send({ type: "status", stage: "searching" })

        const answer = await answerFromPlan(message, plan, configs, request.signal)
        if (!answer.clarifyingQuestion) writeCache(cacheKey, answer)

        send({ type: "answer", answer, cached: false })
        controller.close()
      } catch (error) {
        // The detail goes to the server log, never to the browser. The
        // messages reaching here include provider responses and filesystem
        // paths — "gemini 404: models/... is no longer available", or an
        // ENOENT naming the deploy directory — none of which a visitor needs
        // and all of which help someone mapping the system.
        console.error("[api/ask]", error)
        send({ type: "error", error: "The assistant could not answer that. Try again." })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  })
}
