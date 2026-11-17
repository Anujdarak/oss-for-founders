/**
 * Emits public/search-index.json: the trimmed documents the client-side
 * assistant and search box run over.
 *
 * Built at build time rather than shipped inside a page payload. At ~4,900
 * repos the file is megabytes, and nobody landing on the home page should pay
 * for it -- /ask and /saved fetch it on demand instead.
 */
import { gzipSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { getAllRepos } from "../lib/data"
import { toSearchDoc } from "../lib/search"

const OUT_DIR = path.join(process.cwd(), "public")
const OUT_PATH = path.join(OUT_DIR, "search-index.json")

/**
 * Warn on the compressed size, because that is what a visitor actually waits
 * for -- the file is served gzipped or brotlied. Raw size is roughly 4x this
 * and warning on it just cries wolf on every build.
 */
const WARN_COMPRESSED_BYTES = 1_200_000

const repos = getAllRepos()
const docs = repos.map(toSearchDoc)

mkdirSync(OUT_DIR, { recursive: true })
const json = JSON.stringify(docs)
writeFileSync(OUT_PATH, json, "utf8")

const raw = Buffer.byteLength(json)
const compressed = gzipSync(json).length

console.log(
  `search index: ${docs.length} docs, ${(raw / 1024).toFixed(0)} KB raw / ` +
    `${(compressed / 1024).toFixed(0)} KB gzipped -> public/search-index.json`
)

if (compressed > WARN_COMPRESSED_BYTES) {
  console.warn(
    `  warning: ${(compressed / 1024).toFixed(0)} KB compressed is a lot to fetch on a phone.\n` +
      `  Consider splitting the index per category and loading only what a query needs.`
  )
}
