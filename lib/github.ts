/**
 * Minimal GitHub REST client for the build-time scripts. Official REST API only
 * -- no scraping, no third-party mirrors.
 *
 * Node-only: it reads `process.env` and is imported by `scripts/`, never by a
 * page. Keeping it out of the app bundle is deliberate; the site ships no
 * network calls at all.
 */

const API = "https://api.github.com"
const USER_AGENT = "oss-for-founders-build"

export type RateState = {
  limit: number
  remaining: number
  /** Epoch seconds when the window resets. */
  reset: number
  /** Requests this process has made. */
  used: number
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string
  ) {
    super(message)
    this.name = "GitHubError"
  }
}

export class MissingTokenError extends Error {
  constructor() {
    super(
      [
        "GITHUB_TOKEN is not set.",
        "",
        "The GitHub REST API allows only 60 unauthenticated requests per hour,",
        "which is not enough to refresh stats or run discovery. Create a token",
        "with no scopes (public data is all this needs) and export it:",
        "",
        "  https://github.com/settings/tokens/new  (no scopes required)",
        "",
        "  PowerShell:  $env:GITHUB_TOKEN = 'ghp_...'",
        "  bash:        export GITHUB_TOKEN=ghp_...",
      ].join("\n")
    )
    this.name = "MissingTokenError"
  }
}

export class BadTokenError extends Error {
  constructor(status: number) {
    super(
      [
        `GitHub rejected the token (HTTP ${status}).`,
        "",
        status === 401
          ? "401 means the token is wrong, revoked, or expired — not that it lacks permissions."
          : "403 here usually means the token is blocked or the org has restricted it.",
        "",
        "Check, in this order:",
        "  1. GITHUB_TOKEN in .env has no stray quotes, spaces, or a trailing newline.",
        "  2. The token has not expired: https://github.com/settings/tokens",
        "  3. It is a classic token or a fine-grained token with public-repo read access.",
        "",
        "A scopeless classic token is enough — everything here reads public data.",
      ].join("\n")
    )
    this.name = "BadTokenError"
  }
}

export function requireToken(): string {
  const token = process.env.GITHUB_TOKEN?.trim()
  if (!token) throw new MissingTokenError()
  return token
}

export type RateLimitSnapshot = {
  core: { remaining: number; limit: number; reset: number }
  search: { remaining: number; limit: number; reset: number }
  graphql: { remaining: number; limit: number; reset: number }
}

/**
 * One authenticated call to /rate_limit before any real work.
 *
 * It is the cheapest possible way to tell "the token is broken" apart from
 * "the query returned nothing", and /rate_limit does not itself count against
 * the limit. A long import that dies on request 400 because the token was
 * pasted with a trailing space is a bad way to find out.
 */
export async function verifyToken(token: string): Promise<RateLimitSnapshot> {
  const response = await fetch(`${API}/rate_limit`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": USER_AGENT,
    },
  })

  if (response.status === 401 || response.status === 403) {
    throw new BadTokenError(response.status)
  }
  if (!response.ok) {
    throw new GitHubError(
      `could not reach the GitHub API (HTTP ${response.status})`,
      response.status,
      `${API}/rate_limit`
    )
  }

  const body = (await response.json()) as {
    resources: Record<string, { remaining: number; limit: number; reset: number }>
  }

  const pick = (name: string) =>
    body.resources[name] ?? { remaining: 0, limit: 0, reset: 0 }

  return {
    core: pick("core"),
    search: pick("search"),
    graphql: pick("graphql"),
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class GitHubClient {
  readonly rate: RateState = {
    limit: 0,
    remaining: Number.POSITIVE_INFINITY,
    reset: 0,
    used: 0,
  }

  constructor(
    private readonly token: string,
    private readonly log: (message: string) => void = () => {}
  ) {}

  /**
   * One request, with the two kinds of waiting the API asks for: pre-emptive
   * sleeping when the remaining budget is nearly gone, and honouring
   * `retry-after` / reset on a 403 or 429 secondary limit.
   */
  async request<T>(
    path: string,
    { retries = 4 }: { retries?: number } = {}
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${API}${path}`

    for (let attempt = 0; attempt <= retries; attempt++) {
      await this.waitForBudget()

      const response = await fetch(url, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${this.token}`,
          "user-agent": USER_AGENT,
          "x-github-api-version": "2022-11-28",
        },
      })

      this.readRateHeaders(response.headers)
      this.rate.used += 1

      if (response.ok) return (await response.json()) as T

      // 404 and 451 are facts about the repo, not transport failures.
      if (response.status === 404 || response.status === 451) {
        throw new GitHubError(`HTTP ${response.status}`, response.status, url)
      }

      const isRateLimited =
        response.status === 429 ||
        (response.status === 403 &&
          (this.rate.remaining === 0 ||
            response.headers.has("retry-after") ||
            /rate limit|abuse|secondary/i.test(await safeText(response))))

      if (isRateLimited && attempt < retries) {
        const waitMs = this.rateLimitWaitMs(response.headers, attempt)
        this.log(
          `rate limited (HTTP ${response.status}); waiting ${Math.ceil(waitMs / 1000)}s`
        )
        await sleep(waitMs)
        continue
      }

      if (response.status >= 500 && attempt < retries) {
        const waitMs = backoffMs(attempt)
        this.log(`HTTP ${response.status}; retrying in ${Math.ceil(waitMs / 1000)}s`)
        await sleep(waitMs)
        continue
      }

      throw new GitHubError(`HTTP ${response.status}`, response.status, url)
    }

    throw new GitHubError("retries exhausted", 0, url)
  }

  /** Sleeps until the window resets when the remaining budget is nearly gone. */
  private async waitForBudget(): Promise<void> {
    if (this.rate.remaining > 2 || !this.rate.reset) return

    const waitMs = Math.max(0, this.rate.reset * 1000 - Date.now()) + 1_000
    this.log(
      `rate budget exhausted (${this.rate.remaining} left); waiting ${Math.ceil(waitMs / 1000)}s for reset`
    )
    await sleep(waitMs)
    this.rate.remaining = this.rate.limit || 1
  }

  private rateLimitWaitMs(headers: Headers, attempt: number): number {
    const retryAfter = Number(headers.get("retry-after"))
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000 + 500

    const reset = Number(headers.get("x-ratelimit-reset"))
    if (Number.isFinite(reset) && reset > 0) {
      const until = reset * 1000 - Date.now()
      if (until > 0) return until + 1_000
    }

    return backoffMs(attempt)
  }

  private readRateHeaders(headers: Headers): void {
    const limit = Number(headers.get("x-ratelimit-limit"))
    const remaining = Number(headers.get("x-ratelimit-remaining"))
    const reset = Number(headers.get("x-ratelimit-reset"))

    if (Number.isFinite(limit)) this.rate.limit = limit
    if (Number.isFinite(remaining)) this.rate.remaining = remaining
    if (Number.isFinite(reset)) this.rate.reset = reset
  }
}

function backoffMs(attempt: number): number {
  // 2s, 4s, 8s, 16s with jitter.
  return 2 ** (attempt + 1) * 1000 + Math.random() * 500
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.clone().text()
  } catch {
    return ""
  }
}

/** The subset of the repo payload this project uses. */
export type GitHubRepo = {
  id: number
  name: string
  full_name: string
  owner: { login: string; avatar_url: string }
  html_url: string
  description: string | null
  homepage: string | null
  language: string | null
  license: { spdx_id: string | null } | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  pushed_at: string
  created_at: string
  archived: boolean
  disabled?: boolean
  fork: boolean
  topics?: string[]
  default_branch?: string
  size?: number
}

export type SearchResult = {
  total_count: number
  incomplete_results: boolean
  items: GitHubRepo[]
}

/** GitHub reports an unrecognised licence as NOASSERTION, which is not a licence name. */
export function spdxId(repo: GitHubRepo): string | undefined {
  const id = repo.license?.spdx_id
  if (!id || id === "NOASSERTION" || id === "NONE") return undefined
  return id
}

export function searchPath(
  query: string,
  { page = 1, perPage = 100, sort }: { page?: number; perPage?: number; sort?: string } = {}
): string {
  const params = new URLSearchParams({
    q: query,
    per_page: String(perPage),
    page: String(page),
  })
  if (sort) params.set("sort", sort)
  return `/search/repositories?${params.toString()}`
}
