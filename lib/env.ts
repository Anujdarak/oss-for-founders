/**
 * Loads `.env.local` then `.env` for the build scripts.
 *
 * Next loads these itself for the app, but the scripts in `scripts/` run under
 * plain tsx, which does not. Without this, a GITHUB_TOKEN sitting in `.env`
 * would be silently ignored and `npm run discover` would keep insisting the
 * token was missing.
 *
 * Node-only: never import this from a page or component.
 */
import { existsSync } from "node:fs"
import path from "node:path"

import { config } from "dotenv"

/** Real environment variables win; a file never overwrites something already set. */
const FILES = [".env.local", ".env"] as const

let loaded = false

export function loadEnv(cwd = process.cwd()): void {
  if (loaded) return
  loaded = true

  for (const file of FILES) {
    const full = path.join(cwd, file)
    if (!existsSync(full)) continue

    // `override: false` is the default and is the behaviour we want: a value
    // exported in the real environment (CI, a one-off shell prefix) beats the
    // file, and the first file read wins over later ones.
    const result = config({ path: full, override: false, quiet: true })
    if (result.error) {
      console.warn(`warning: could not read ${file}: ${result.error.message}`)
    }
  }
}

/**
 * The token, trimmed, or undefined. Quotes are stripped by dotenv, but a
 * trailing space pasted in from a browser is not, and it produces a 401 that
 * looks like a bad token rather than a bad copy-paste.
 */
export function readToken(): string | undefined {
  const token = process.env.GITHUB_TOKEN?.trim()
  return token ? token : undefined
}
