/**
 * GraphQL client for bulk discovery.
 *
 * Why GraphQL rather than REST search: one request returns a page of repos
 * with every field this project stores *including whether a README exists*.
 * Over a few thousand candidates that collapses the same number of extra REST
 * calls to zero, which is most of the runtime. It is also not subject to the
 * REST search endpoint's 30-requests-per-minute cap.
 *
 * What it does not change: GitHub's search index still caps any one query at
 * 1,000 results, so the caller must still split queries by star range and date
 * window. GraphQL is cheaper per repo, not deeper.
 *
 * Node-only. The site never calls this.
 */

const ENDPOINT = "https://api.github.com/graphql"
const USER_AGENT = "oss-for-founders-build"

/**
 * Page size. Measured against the live API, not guessed: at `first: 100` this
 * query times out with a 502 or 504 every single time -- with or without the
 * README fields, and even with the issue count removed. 50 returns in well
 * under a second and still costs one rate-limit point, so the only thing a
 * bigger page would buy is failure.
 */
const PAGE_SIZE = 50
/** Dropped to this when a page still fails, before giving up on GraphQL. */
const FALLBACK_PAGE_SIZE = 25

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type GqlRepo = {
  databaseId: number | null
  name: string
  nameWithOwner: string
  owner: { login: string; avatarUrl: string }
  url: string
  description: string | null
  homepageUrl: string | null
  stargazerCount: number
  forkCount: number
  primaryLanguage: { name: string } | null
  licenseInfo: { spdxId: string | null; key: string | null } | null
  repositoryTopics: { nodes: { topic: { name: string } }[] }
  pushedAt: string | null
  createdAt: string
  isArchived: boolean
  isDisabled: boolean
  isFork: boolean
  isMirror: boolean
  issues: { totalCount: number }
  readmeMd: { byteSize?: number } | null
  readmeLower: { byteSize?: number } | null
}

export type GqlSearchPage = {
  repositoryCount: number
  hasNextPage: boolean
  endCursor: string | null
  nodes: GqlRepo[]
  /** Points this request cost, and what is left this hour. */
  cost: number
  remaining: number
}

const searchQuery = (pageSize: number) => `
query Search($q: String!, $after: String) {
  rateLimit { cost remaining resetAt }
  search(query: $q, type: REPOSITORY, first: ${pageSize}, after: $after) {
    repositoryCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on Repository {
        databaseId
        name
        nameWithOwner
        owner { login avatarUrl }
        url
        description
        homepageUrl
        stargazerCount
        forkCount
        primaryLanguage { name }
        licenseInfo { spdxId key }
        repositoryTopics(first: 20) { nodes { topic { name } } }
        pushedAt
        createdAt
        isArchived
        isDisabled
        isFork
        isMirror
        issues(states: OPEN) { totalCount }
        readmeMd: object(expression: "HEAD:README.md") { ... on Blob { byteSize } }
        readmeLower: object(expression: "HEAD:readme.md") { ... on Blob { byteSize } }
      }
    }
  }
}`

export class GraphQLUnavailable extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = "GraphQLUnavailable"
  }
}

export class GraphQLClient {
  /** Points used this process, for the report. */
  pointsUsed = 0
  remaining = Number.POSITIVE_INFINITY
  requests = 0

  constructor(
    private readonly token: string,
    private readonly log: (message: string) => void = () => {}
  ) {}

  /** Lowered permanently once a gateway error shows this query is too heavy. */
  private pageSize = PAGE_SIZE

  async search(
    q: string,
    after: string | null = null,
    { retries = 5 }: { retries?: number } = {}
  ): Promise<GqlSearchPage> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          "user-agent": USER_AGENT,
        },
        body: JSON.stringify({
          query: searchQuery(this.pageSize),
          variables: { q, after },
        }),
      })

      this.requests += 1

      if (response.status === 401) {
        throw new GraphQLUnavailable("token rejected (401)")
      }

      // A rate limit is never fatal: wait it out and try the same page again.
      if (response.status === 403 || response.status === 429) {
        const waitMs = waitFromHeaders(response.headers, attempt)
        this.log(
          `graphql ${response.status}; sleeping ${Math.ceil(waitMs / 1000)}s then retrying`
        )
        await sleep(waitMs)
        continue
      }

      // 502/504 from this endpoint means the query was too expensive to
      // resolve in time, not that GitHub is down. Shrinking the page fixes it;
      // waiting does not.
      if (response.status === 502 || response.status === 504) {
        if (this.pageSize > FALLBACK_PAGE_SIZE) {
          this.pageSize = FALLBACK_PAGE_SIZE
          this.log(
            `graphql ${response.status}; dropping page size to ${this.pageSize} and retrying`
          )
          continue
        }
        if (attempt < retries) {
          const waitMs = backoff(attempt)
          this.log(`graphql ${response.status}; retrying in ${Math.ceil(waitMs / 1000)}s`)
          await sleep(waitMs)
          continue
        }
        throw new GraphQLUnavailable(`HTTP ${response.status} at page size ${this.pageSize}`)
      }

      if (response.status >= 500) {
        const waitMs = backoff(attempt)
        this.log(`graphql ${response.status}; retrying in ${Math.ceil(waitMs / 1000)}s`)
        await sleep(waitMs)
        continue
      }

      if (!response.ok) {
        throw new GraphQLUnavailable(`HTTP ${response.status}`)
      }

      const body = (await response.json()) as {
        data?: {
          rateLimit?: { cost: number; remaining: number; resetAt: string }
          search?: {
            repositoryCount: number
            pageInfo: { hasNextPage: boolean; endCursor: string | null }
            nodes: (GqlRepo | Record<string, never>)[]
          }
        }
        errors?: { type?: string; message: string }[]
      }

      if (body.errors?.length) {
        const rateLimited = body.errors.some(
          (error) => error.type === "RATE_LIMITED"
        )
        if (rateLimited && attempt < retries) {
          const waitMs = waitFromHeaders(response.headers, attempt)
          this.log(`graphql RATE_LIMITED; sleeping ${Math.ceil(waitMs / 1000)}s`)
          await sleep(waitMs)
          continue
        }

        // A query GitHub cannot parse is a bug in the query, not a transient
        // failure. Surface it so the caller can fall back to REST.
        throw new GraphQLUnavailable(
          body.errors.map((error) => error.message).join("; ")
        )
      }

      const search = body.data?.search
      if (!search) throw new GraphQLUnavailable("response contained no search data")

      const rate = body.data?.rateLimit
      if (rate) {
        this.pointsUsed += rate.cost
        this.remaining = rate.remaining
      }

      return {
        repositoryCount: search.repositoryCount,
        hasNextPage: search.pageInfo.hasNextPage,
        endCursor: search.pageInfo.endCursor,
        // Non-Repository nodes come back as {}; drop them.
        nodes: search.nodes.filter(
          (node): node is GqlRepo => "nameWithOwner" in node
        ),
        cost: rate?.cost ?? 0,
        remaining: rate?.remaining ?? Number.POSITIVE_INFINITY,
      }
    }

    throw new GraphQLUnavailable("retries exhausted")
  }
}

function waitFromHeaders(headers: Headers, attempt: number): number {
  const retryAfter = Number(headers.get("retry-after"))
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000 + 500

  const reset = Number(headers.get("x-ratelimit-reset"))
  if (Number.isFinite(reset) && reset > 0) {
    const until = reset * 1000 - Date.now()
    // Cap the wait so a bad clock cannot park the import for an hour.
    if (until > 0) return Math.min(until + 1_000, 15 * 60 * 1000)
  }

  return backoff(attempt)
}

function backoff(attempt: number): number {
  return 2 ** (attempt + 1) * 1000 + Math.random() * 500
}

/** GitHub reports an unrecognised licence as NOASSERTION, which is not a licence name. */
export function gqlSpdx(repo: GqlRepo): string | undefined {
  const id = repo.licenseInfo?.spdxId
  if (!id || id === "NOASSERTION" || id === "NONE") return undefined
  return id
}

export function gqlTopics(repo: GqlRepo): string[] {
  return repo.repositoryTopics.nodes.map((node) => node.topic.name)
}

/**
 * Only README.md and readme.md are checked. Adding .rst and extension-less
 * README pushed the query over the timeout threshold, and the two covered here
 * account for the overwhelming majority -- a false negative costs a repo a
 * fraction of one scoring component, which is not worth a failed query.
 */
export function gqlHasReadme(repo: GqlRepo): boolean {
  return Boolean(repo.readmeMd || repo.readmeLower)
}
