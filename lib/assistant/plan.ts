import { CATEGORIES, CATEGORY_META, type Category } from "../categories"
import { GOALS, NEEDS, PRODUCT_NEEDS, getNeed } from "./needs"
import { stem } from "./stem"

/**
 * The plan is what the pipeline searches with. It is produced either by the
 * LLM (`understand()` in llm.ts) or by `planLocally()` below, and both paths
 * must produce the same shape so the rest of the pipeline cannot tell which
 * ran. That is what makes the no-key fallback a real path rather than a
 * degraded one.
 */
export type PlanNeed = {
  /** Taxonomy key when it maps to one, otherwise a slug of the label. */
  key: string
  /** Section heading. */
  label: string
  /** The phrase actually searched for this need. */
  query: string
  /**
   * Taxonomy key whose keywords, categories and prebuilt vector this need
   * borrows, when `key` is not itself a taxonomy key. The LLM writes its own
   * need labels, which almost never match a taxonomy label verbatim; without
   * this, every LLM need was searched on bare BM25 with no embedding at all.
   */
  basis?: string
  /** A query vector supplied directly, e.g. a named repo's own embedding. */
  vectorFromRepo?: string
  /** Repo ids that must not appear under this need. */
  exclude?: string[]
  /**
   * The reader's own specific words ("nextjs" in "auth for my nextjs app"),
   * scored as a separate lexical signal. Appended to the taxonomy keywords
   * instead, one qualifier is one term in twenty-five and changes nothing.
   */
  focus?: string
  /** Expected categories, overriding the taxonomy's. */
  categories?: Category[]
}

export type PlanConstraints = {
  selfHosted: boolean
  beginnerFriendly: boolean
  language?: string
}

export type Plan = {
  goal: string
  domain: string
  needs: PlanNeed[]
  searchQueries: string[]
  constraints: PlanConstraints
  needsClarification: boolean
  clarifyingQuestion?: string
  /** Chips offered with the clarifying question. */
  clarifyOptions: string[]
  /** Which provider answered, when the LLM planner ran. */
  provider?: "gemini" | "grok" | "groq" | "openrouter"
  /** Which planner produced this. */
  source: "llm" | "local"
  /** Repo ids named in the message, resolved by `detectNamedRepos`. */
  named?: { direct: string[]; alternativesTo: string[]; onlyNames?: boolean }
}

/**
 * Words that must never reach the search layer.
 *
 * This list is the direct fix for the reported bug. "I want to improve my ui
 * ux of my website" contains exactly one noun the old engine could latch onto
 * — "website" — and it is the single least informative word in the sentence.
 * Every repo that serves a web page mentions it. The same is true of "app",
 * "product", "startup", "project" and "platform": they describe the thing the
 * founder owns, never the tool they need.
 */
const STOPWORDS = new Set([
  "a", "about", "actually", "add", "after", "all", "already", "also", "am", "an", "and", "any",
  "anyone", "app", "application", "apps", "are", "around", "as", "at", "back", "based", "be",
  "because", "been", "being", "best", "better", "bit", "both", "build", "building", "built",
  "business", "but", "buy", "by", "can", "cheap", "company", "could", "create", "currently",
  "customers", "do", "does", "doing", "done", "down", "each", "easy", "etc", "even", "ever",
  "every", "everything", "find", "first", "for", "free", "from", "get", "getting", "give", "go",
  "going", "good", "got", "great", "had", "has", "have", "help", "her", "here", "his", "how",
  "i", "idea", "if", "im", "implement", "improve", "improving", "in", "integrate", "into", "is",
  "it", "its", "just", "keep", "kind", "know", "launch", "less", "let", "like", "looking",
  "lot", "make", "making", "many", "may", "maybe", "me", "mine", "more", "most", "much", "my",
  "need", "needed", "needs", "new", "nice", "no", "not", "now", "of", "off", "on", "one",
  "only", "open", "option", "options", "or", "other", "our", "out", "over", "own", "people",
  "platform", "please", "possible", "product", "project", "proper", "put", "really", "recommend",
  "right", "run", "running", "saas", "same", "see", "service", "set", "setup", "several",
  "should", "show", "side", "similar", "simple", "site", "so", "software", "solution", "some",
  "something", "source", "start", "started", "startup", "stuff", "such", "suggest", "system",
  "take", "team", "tell", "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "thing", "things", "think", "this", "those", "to", "today", "tool", "tools", "top",
  "try", "two", "up", "us", "use", "used", "user", "users", "using", "very", "want", "wanted",
  "wants", "was", "way", "we", "web", "webapp", "website", "websites", "well", "what", "when",
  "where", "which", "while", "who", "why", "will", "with", "within", "without", "work",
  "working", "would", "you", "your",
])

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word)
}

export function contentWords(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9+#. -]/g, " ")
    .split(/[\s-]+/)
    .map((word) => word.replace(/^[.]+|[.]+$/g, ""))
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
}

/** Languages worth filtering on, matched as whole words. */
const LANGUAGES: Record<string, string> = {
  typescript: "TypeScript", javascript: "JavaScript", python: "Python", go: "Go",
  golang: "Go", rust: "Rust", ruby: "Ruby", php: "PHP", java: "Java", kotlin: "Kotlin",
  swift: "Swift", "c#": "C#", csharp: "C#", elixir: "Elixir", scala: "Scala", dart: "Dart",
  node: "TypeScript", react: "TypeScript", vue: "Vue", svelte: "Svelte",
}

export function detectConstraints(message: string): PlanConstraints {
  const lower = message.toLowerCase()

  const selfHosted =
    /\bself[- ]?host(ed|ing)?\b/.test(lower) ||
    /\bon[- ]?prem(ise|ises)?\b/.test(lower) ||
    /\b(own|my) (server|infrastructure|hardware|machine)\b/.test(lower)

  const beginnerFriendly =
    /\b(beginner|simpler|simplest|easy|easiest|lightweight|minimal|no[- ]code|non[- ]technical)\b/.test(lower) ||
    /\b(just|solo) (starting|getting started|founder|dev)\b/.test(lower)

  let language: string | undefined
  for (const [token, label] of Object.entries(LANGUAGES)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lower)) {
      language = label
      break
    }
  }

  return { selfHosted, beginnerFriendly, ...(language ? { language } : {}) }
}

/**
 * Remove the phrases already consumed as constraints before scoring needs.
 *
 * A constraint says *how* the tool must be, never *what* it must do, so
 * letting it also vote on the need double-counts it. "self-hosted analytics"
 * resolved to deployment tooling first and analytics second, because
 * "self-hosted" stems to `host` and met `hosting` in the deploy-paas
 * keywords. Once the constraint is extracted, the word has done its job.
 */
function stripConstraintPhrases(message: string): string {
  return message
    .replace(/\bself[- ]?host(ed|ing)?\b/gi, " ")
    .replace(/\bon[- ]?prem(ise|ises)?\b/gi, " ")
    .replace(/\b(beginner[- ]friendly|no[- ]code|low[- ]code)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** "alternative to Notion", "something like Intercom", "Notion but open source". */
export function detectNamedProducts(message: string): string[] {
  const lower = message.toLowerCase()
  const found: string[] = []
  for (const product of Object.keys(PRODUCT_NEEDS)) {
    const escaped = product.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(lower)) found.push(product)
  }
  return found
}

/**
 * Score every need against the message lexically. Used on its own for direct
 * requests ("I need a vector database") and as a tie-breaker behind a matched
 * goal.
 */
export function scoreNeedsLexically(message: string): Map<string, number> {
  const lower = ` ${message.toLowerCase().replace(/[^a-z0-9+#]/g, " ")} `
  const words = new Set(contentWords(message))
  // Stemmed, so "vulnerabilities" reaches `vulnerability` and "scrape"
  // reaches `scraping`. Matching raw forms missed most of these.
  const stems = new Set([...words].map(stem))
  const scores = new Map<string, number>()

  for (const need of NEEDS) {
    let score = 0

    // A keyword present as a whole word is the strongest lexical signal.
    for (const keyword of need.keywords) {
      const plain = keyword.replace(/-/g, " ")
      // Single-word keywords still have to clear the stopword list. Without
      // this the raw-message check below bypassed it entirely: "build" is a
      // stopword but was also a ci-cd keyword, so "build a chatbot over my
      // docs" resolved to continuous integration.
      if (!plain.includes(" ") && STOPWORDS.has(plain)) continue
      if (lower.includes(` ${plain} `)) {
        score += 2
        continue
      }
      if (plain.includes(" ")) {
        if (lower.includes(plain)) score += 1.5
        // A hyphenated keyword also matches when every part is present:
        // "end to end browser tests" should reach `e2e`-adjacent testing.
        else if (plain.split(" ").every((part) => stems.has(stem(part)))) score += 1.25
        continue
      }
      if (stems.has(stem(keyword))) score += 2
    }

    // The label is often said verbatim ("project management", "error tracking").
    const label = need.label.toLowerCase()
    if (lower.includes(` ${label} `)) score += 3
    else if (label.split(/\s+/).every((part) => part.length < 3 || stems.has(stem(part)))) score += 1.5

    // Individual words of the need's own query, weighted far lower: this is
    // what keeps a single shared word from carrying a match on its own.
    for (const token of need.query.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length > 3 && !STOPWORDS.has(token) && stems.has(stem(token))) score += 0.35
    }

    if (score > 0) scores.set(need.key, score)
  }

  return scores
}

/** A message with no usable content words cannot be searched for. */
function isTooVague(message: string, needKeys: string[]): boolean {
  if (needKeys.length > 0) return false
  const words = contentWords(message)
  return words.length === 0 || message.trim().split(/\s+/).length <= 2
}

const CLARIFY_CHIPS = [
  "Authentication",
  "Analytics",
  "UI components",
  "Deployment",
  "Database",
  "Customer support",
]

/**
 * The no-LLM planner.
 *
 * Resolution order is deliberate: a named product is the most specific signal
 * a message can carry, a goal pattern is next, and raw keyword scoring is the
 * last resort rather than the first move.
 */
export function planLocally(message: string, history: string[] = []): Plan {
  const constraints = detectConstraints(message)
  const lower = message.toLowerCase()

  // A bare follow-up ("only self-hosted", "simpler ones") has no subject of
  // its own; it refines whatever was last asked.
  const bareModifier =
    contentWords(message).length === 0 ||
    /^(only |show |something |anything )?(self[- ]?hosted|simpler|easier|smaller|alternatives?|other options?)\b/.test(
      lower.trim()
    )
  const effective =
    bareModifier && history.length > 0 ? `${history[history.length - 1]} ${message}` : message

  const needKeys: string[] = []
  const push = (keys: string[]) => {
    for (const key of keys) if (getNeed(key) && !needKeys.includes(key)) needKeys.push(key)
  }

  // 1. Named products.
  const products = detectNamedProducts(effective)
  for (const product of products) push(PRODUCT_NEEDS[product] ?? [])

  // 2. Goal patterns. These are what turn a vague outcome into several needs.
  const goals = GOALS.filter((goal) => goal.patterns.some((pattern) => pattern.test(effective.toLowerCase())))
  for (const goal of goals) push(goal.needs)

  // 3. Lexical need scoring, to catch direct requests and to extend a goal.
  //    Scored against the message with constraint phrases removed.
  const lexical = [...scoreNeedsLexically(stripConstraintPhrases(effective)).entries()]
    .filter(([, score]) => score >= 2)
    .sort((a, b) => b[1] - a[1])

  if (needKeys.length === 0) {
    push(lexical.slice(0, 4).map(([key]) => key))
  } else {
    // Only strongly-scoring extras, so a goal's shape is not diluted.
    push(lexical.filter(([, score]) => score >= 4).slice(0, 2).map(([key]) => key))
  }

  // A one-need question usually carries a qualifier the taxonomy phrase does
  // not: "auth for my *nextjs* app". Keep those words in the search, or the
  // answer is generic authentication. Only for a single need: with several,
  // a qualifier belongs to one of them and would skew the rest.
  const qualifiers =
    needKeys.length === 1
      ? contentWords(stripConstraintPhrases(effective)).filter((word) => {
          const spec = getNeed(needKeys[0])!
          const known = `${spec.label} ${spec.query} ${spec.keywords.join(" ")}`.toLowerCase()
          return !known.includes(word)
        })
      : []

  const needs: PlanNeed[] = needKeys.slice(0, 6).map((key) => {
    const need = getNeed(key)!
    return {
      key,
      label: need.label,
      query: need.query,
      ...(qualifiers.length > 0 ? { focus: qualifiers.join(" ") } : {}),
    }
  })

  const vague = isTooVague(effective, needKeys)
  const goal = goals[0]?.describes ?? (products.length > 0 ? `an alternative to ${products[0]}` : message.trim())

  return {
    goal,
    domain: inferDomain(needs),
    needs,
    searchQueries: needs.map((need) => need.query),
    constraints,
    needsClarification: vague,
    ...(vague
      ? {
          clarifyingQuestion:
            "I can search 4,900 repos, but not for everything at once — which part are you working on?",
        }
      : {}),
    clarifyOptions: vague ? CLARIFY_CHIPS : [],
    source: "local",
  }
}

/** A human-readable domain, used in the summary line. */
function inferDomain(needs: PlanNeed[]): string {
  const counts = new Map<Category, number>()
  for (const need of needs) {
    for (const category of getNeed(need.key)?.categories ?? []) {
      counts.set(category, (counts.get(category) ?? 0) + 1)
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return best ? CATEGORY_META[best[0]].label : "open source tooling"
}

/** Categories a plan's needs point at, for the no-match fallback. */
export function planCategories(plan: Plan): Category[] {
  const out = new Set<Category>()
  for (const need of plan.needs) {
    for (const category of getNeed(need.key)?.categories ?? getNeed(need.basis ?? "")?.categories ?? []) {
      out.add(category)
    }
  }
  return [...out].filter((category): category is Category => CATEGORIES.includes(category))
}
