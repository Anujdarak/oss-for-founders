/**
 * Browser-only persistence for the two things that are genuinely per-person:
 * bookmarks and recently viewed. There is no account system and no backend, so
 * this never leaves the device and is never read by the server.
 *
 * Shaped as an external store (subscribe / getSnapshot) so components can read
 * it through `useSyncExternalStore`. Snapshots are cached because that hook
 * requires a stable reference between changes -- returning a freshly parsed
 * array every call makes React re-render forever.
 *
 * Every access is wrapped: `localStorage` throws outright in a few real
 * situations (Safari private mode, cookies-blocked settings, storage full), and
 * a saved-repos list is not worth breaking a page over.
 */

export const BOOKMARKS_KEY = "ossff:bookmarks:v1"
export const RECENT_KEY = "ossff:recent:v1"

/** Recently viewed is a short list by design -- it is a convenience, not a history. */
export const RECENT_LIMIT = 12

export type RecentEntry = {
  /** Repo id. */
  id: string
  /** Epoch ms. Written in the browser, so no prerender clock problem. */
  at: number
}

function readRaw<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeRaw(key: string, value: unknown): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Out of quota or storage blocked. Nothing actionable, and nothing worth
    // interrupting the reader for.
  }
}

/** Stable empty values, so the server snapshot never changes identity. */
const EMPTY_IDS: readonly string[] = Object.freeze([])
const EMPTY_RECENT: readonly RecentEntry[] = Object.freeze([])

let bookmarksCache: readonly string[] | null = null
let recentCache: readonly RecentEntry[] | null = null

const listeners = new Set<() => void>()

function emit(): void {
  bookmarksCache = null
  recentCache = null
  for (const listener of listeners) listener()
}

/** Subscribes to changes from this tab and from others. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === BOOKMARKS_KEY || event.key === RECENT_KEY) {
      emit()
    }
  }
  window.addEventListener("storage", onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function getBookmarks(): readonly string[] {
  if (bookmarksCache) return bookmarksCache
  const value = readRaw<unknown>(BOOKMARKS_KEY, [])
  bookmarksCache = Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : EMPTY_IDS
  return bookmarksCache
}

export function getServerBookmarks(): readonly string[] {
  return EMPTY_IDS
}

export function getRecent(): readonly RecentEntry[] {
  if (recentCache) return recentCache
  const value = readRaw<unknown>(RECENT_KEY, [])
  recentCache = Array.isArray(value)
    ? value.filter(
        (entry): entry is RecentEntry =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as RecentEntry).id === "string" &&
          typeof (entry as RecentEntry).at === "number"
      )
    : EMPTY_RECENT
  return recentCache
}

export function getServerRecent(): readonly RecentEntry[] {
  return EMPTY_RECENT
}

export function toggleBookmark(id: string): void {
  const current = getBookmarks()
  const next = current.includes(id)
    ? current.filter((existing) => existing !== id)
    : [id, ...current]
  writeRaw(BOOKMARKS_KEY, next)
  emit()
}

/** Most recent first, one entry per repo. */
export function recordView(id: string): void {
  const next = [
    { id, at: Date.now() },
    ...getRecent().filter((entry) => entry.id !== id),
  ].slice(0, RECENT_LIMIT)
  writeRaw(RECENT_KEY, next)
  emit()
}

export function clearRecent(): void {
  writeRaw(RECENT_KEY, [])
  emit()
}
