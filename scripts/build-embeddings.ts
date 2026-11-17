/**
 * Emits data/embeddings.json: one sentence embedding per repo, plus one per
 * need in the taxonomy.
 *
 * Runs at build time with transformers.js and all-MiniLM-L6-v2 — local, free,
 * no API key, no network at request time. The model is a devDependency and is
 * never shipped to the browser or imported by a page.
 *
 * Vectors are normalised, then quantised to int8 and base64'd. At 4,906 repos
 * x 384 dimensions, plain JSON floats would be ~13MB and slow to parse on
 * every cold start; this is ~2.5MB and decodes with a single Buffer call.
 * Quantisation costs almost nothing in ranking quality because cosine on
 * normalised vectors only cares about direction.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { pipeline, env } from "@huggingface/transformers"

import { CATEGORY_META } from "../lib/categories"
import { getAllRepos } from "../lib/data"
import { NEEDS } from "../lib/assistant/needs"
import { EMBEDDING_DIMS, EMBEDDING_MODEL, type EmbeddingFile } from "../lib/assistant/embedding-format"

env.allowLocalModels = false

const OUT_PATH = path.join(process.cwd(), "data", "embeddings.json")
const BATCH = 64

/**
 * What gets embedded for a repo.
 *
 * Name first because it is often the only place a product's identity lives
 * ("plausible", "umami"), then the description, then topics and category as
 * plain words. Written as a sentence rather than a field dump: MiniLM is a
 * sentence model and scores natural phrasing noticeably better than a list of
 * slugs.
 */
function repoText(repo: ReturnType<typeof getAllRepos>[number]): string {
  const topics = repo.tags.slice(0, 12).join(", ")
  const category = CATEGORY_META[repo.category].label
  const parts = [
    `${repo.name} by ${repo.owner}.`,
    repo.description,
    topics ? `Topics: ${topics}.` : "",
    `Category: ${category}.`,
    repo.stats?.language ? `Written in ${repo.stats.language}.` : "",
  ]
  return parts.filter(Boolean).join(" ")
}

function quantise(vectors: Float32Array[], dims: number): string {
  const out = new Int8Array(vectors.length * dims)
  for (let i = 0; i < vectors.length; i += 1) {
    const vector = vectors[i]
    for (let d = 0; d < dims; d += 1) {
      // Normalised, so every component is within [-1, 1]. 127 keeps the full
      // int8 range without ever saturating.
      out[i * dims + d] = Math.max(-127, Math.min(127, Math.round(vector[d] * 127)))
    }
  }
  return Buffer.from(out.buffer).toString("base64")
}

async function main() {
  const repos = getAllRepos()
  console.log(`embedding ${repos.length} repos with ${EMBEDDING_MODEL}...`)

  const started = Date.now()
  const extractor = await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "fp32" })
  console.log(`  model ready in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  async function encode(texts: string[]): Promise<Float32Array[]> {
    const output = await extractor(texts, { pooling: "mean", normalize: true })
    const data = output.data as Float32Array
    const dims = output.dims[1] as number
    if (dims !== EMBEDDING_DIMS) {
      throw new Error(`expected ${EMBEDDING_DIMS} dims, model returned ${dims}`)
    }
    return texts.map((_, i) => data.slice(i * dims, (i + 1) * dims) as Float32Array)
  }

  const vectors: Float32Array[] = []
  for (let i = 0; i < repos.length; i += BATCH) {
    const batch = repos.slice(i, i + BATCH)
    vectors.push(...(await encode(batch.map(repoText))))
    if (i % (BATCH * 10) === 0 || i + BATCH >= repos.length) {
      const done = Math.min(i + BATCH, repos.length)
      const rate = done / ((Date.now() - started) / 1000)
      process.stdout.write(`\r  ${done}/${repos.length} (${rate.toFixed(0)}/s)   `)
    }
  }
  process.stdout.write("\n")

  console.log(`embedding ${NEEDS.length} need queries...`)
  const needVectors = await encode(NEEDS.map((need) => need.query))

  const file: EmbeddingFile = {
    model: EMBEDDING_MODEL,
    dims: EMBEDDING_DIMS,
    count: repos.length,
    ids: repos.map((repo) => repo.id),
    vectors: quantise(vectors, EMBEDDING_DIMS),
    needKeys: NEEDS.map((need) => need.key),
    needVectors: quantise(needVectors, EMBEDDING_DIMS),
  }

  mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  const json = JSON.stringify(file)
  writeFileSync(OUT_PATH, json, "utf8")

  console.log(
    `embeddings: ${repos.length} repos + ${NEEDS.length} needs, ` +
      `${(Buffer.byteLength(json) / 1024 / 1024).toFixed(2)} MB -> data/embeddings.json ` +
      `(${((Date.now() - started) / 1000).toFixed(0)}s)`
  )
}

main().catch((error: unknown) => {
  console.error("\nembedding build failed:", error instanceof Error ? error.message : error)
  process.exit(1)
})
