/**
 * The on-disk contract for data/embeddings.json.
 *
 * Kept in its own module with no imports so both the build script and the
 * server-side reader can share it without the reader pulling in transformers.js.
 */
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"
export const EMBEDDING_DIMS = 384

export type EmbeddingFile = {
  model: string
  dims: number
  count: number
  /** Repo ids, in the same order as `vectors`. */
  ids: string[]
  /** base64 of an Int8Array of count * dims. */
  vectors: string
  /** Need taxonomy keys, in the same order as `needVectors`. */
  needKeys: string[]
  /** base64 of an Int8Array of needKeys.length * dims. */
  needVectors: string
}
