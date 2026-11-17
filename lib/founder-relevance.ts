/**
 * Decides whether a repo is a tool a founder could run, as opposed to
 * something a developer reads.
 *
 * The quality score in `lib/scoring.ts` answers "is this well maintained".
 * This answers the different and harder question "is this the kind of thing
 * this catalogue is for" — and the two disagree constantly. A beautifully
 * maintained Kubernetes operator scores 0.95 on quality and is useless to a
 * founder choosing a help desk.
 *
 * Everything here is keyword matching over text GitHub already returns. It is
 * blunt, which is why the thresholds are set to let marginal cases through and
 * the UI labels every discovered entry unreviewed.
 */

/** Signals that this is a product someone runs. */
const PRODUCT_SIGNALS = [
  "self-hosted", "self hosted", "selfhosted", "open-source alternative",
  "open source alternative", "alternative to", "platform", "dashboard",
  "admin panel", "all-in-one", "turnkey", "deploy", "docker", "saas",
  "multi-tenant", "web app", "web application", "server", "service",
  "suite", "workspace", "no-code", "low-code", "drag and drop", "out of the box",
]

/** The founder jobs-to-be-done named in the brief, each with its own vocabulary. */
const NEED_SIGNALS = [
  // SaaS / backend / internal tools
  "backend", "baas", "internal tool", "admin", "api gateway", "headless",
  // CRM and sales
  "crm", "sales", "lead", "pipeline", "customer relationship",
  // Helpdesk and support
  "helpdesk", "help desk", "support", "ticketing", "live chat", "shared inbox",
  "knowledge base", "feedback",
  // Analytics
  "analytics", "business intelligence", "metrics", "tracking", "dashboard",
  "session replay", "telemetry", "observability",
  // Auth and security
  "authentication", "authorization", "identity", "sso", "oauth", "oidc",
  "secrets", "vault", "access control",
  // E-commerce
  "ecommerce", "e-commerce", "storefront", "shop", "cart", "checkout",
  "inventory", "point of sale",
  // CMS and content
  "cms", "content management", "blog", "publishing", "static site",
  // Automation
  "automation", "workflow", "orchestration", "scheduler", "cron", "etl",
  "integration", "webhook",
  // AI apps and infra
  "llm", "rag", "vector", "embedding", "agent", "inference", "chatbot",
  "prompt", "model serving",
  // Email
  "email", "newsletter", "mailing list", "smtp", "transactional",
  // Forms and surveys
  "form", "survey", "questionnaire", "poll",
  // Project management
  "project management", "task", "kanban", "issue tracking", "roadmap",
  "time tracking", "scheduling", "booking", "calendar",
  // Documentation
  "documentation", "docs", "wiki", "notes",
  // Infra a founder actually touches
  "hosting", "paas", "monitoring", "uptime", "logging", "backup",
  "database", "storage", "search engine", "queue", "cdn",
]

/** Things that are read, not run. */
const NON_PRODUCT_SIGNALS = [
  "awesome list", "curated list", "a list of", "collection of", "list of",
  "tutorial", "course", "lesson", "learning", "learn ", "study", "guide to",
  "cheat sheet", "cheatsheet", "interview question", "interview preparation",
  "coding challenge", "leetcode", "exercises", "katas", "workshop",
  "book", "ebook", "notes on", "paper", "papers", "research", "thesis",
  "benchmark suite", "dataset", "specification", "rfc", "proposal",
  "dotfiles", "config files", "my personal", "personal website",
  "portfolio", "resume", "cv ", "blog theme", "showcase",
  "boilerplate", "starter kit", "starter template", "scaffold", "skeleton",
  "example app", "demo app", "sample app", "sample code", "playground",
  "clone of", "reimplementation", "from scratch", "toy ", "experiment",
  "roadmap to", "curriculum", "bootcamp",
]

/** Technical building blocks: fine software, wrong catalogue. */
const LIBRARY_SIGNALS = [
  "library for", "a library", "sdk for", "client library", "api wrapper",
  "wrapper for", "bindings for", "driver for", "plugin for", "extension for",
  "middleware for", "utility functions", "helper functions", "polyfill",
  "parser for", "compiler for", "transpiler", "linter for", "formatter for",
  "type definitions", "component for", "hook for", "module for",
]

export type RelevanceInput = {
  name: string
  description: string
  topics: string[]
  homepage: string | null
}

export type Relevance = {
  /** 0-1. Higher means more likely to be a tool a founder can run. */
  score: number
  /** Matched phrases, so a decision can be explained in the report. */
  productHits: string[]
  needHits: string[]
  negativeHits: string[]
  libraryHits: string[]
}

function countHits(haystack: string, needles: string[]): string[] {
  return needles.filter((needle) => haystack.includes(needle))
}

/**
 * Topics are weighted more heavily than prose because a maintainer choosing
 * `topic:helpdesk` is making a deliberate claim about what the thing is, while
 * a description can mention "support" in passing.
 */
export function scoreRelevance(input: RelevanceInput): Relevance {
  const description = input.description.toLowerCase()
  const name = input.name.toLowerCase().replace(/[-_]/g, " ")
  const topics = input.topics.map((topic) => topic.toLowerCase())
  const topicText = topics.join(" ").replace(/-/g, " ")
  const haystack = `${name} ${description} ${topicText}`

  const productHits = countHits(haystack, PRODUCT_SIGNALS)
  const needHits = countHits(haystack, NEED_SIGNALS)
  const negativeHits = countHits(`${name} ${description}`, NON_PRODUCT_SIGNALS)
  const libraryHits = countHits(description, LIBRARY_SIGNALS)

  let score = 0

  // Addressing a named founder need is the strongest signal, and the second
  // and third matches add less than the first: breadth of vocabulary is not
  // the same as being more relevant.
  if (needHits.length > 0) score += 0.4
  if (needHits.length > 1) score += 0.12
  if (needHits.length > 2) score += 0.08

  if (productHits.length > 0) score += 0.2
  if (productHits.length > 1) score += 0.1

  // A homepage usually means a product with users rather than a side project.
  if (input.homepage) score += 0.08

  // Topics are curated by the maintainer, so agreement between a topic and a
  // founder need is worth more than the same word appearing in prose.
  if (topics.some((topic) => NEED_SIGNALS.includes(topic))) score += 0.12

  score -= negativeHits.length * 0.45
  score -= libraryHits.length * 0.25

  return {
    score: Math.max(0, Math.min(1, score)),
    productHits,
    needHits,
    negativeHits,
    libraryHits,
  }
}

/**
 * Below this an entry is dropped as "not a founder tool".
 *
 * Deliberately lenient. A false negative silently removes a good tool and
 * nobody ever sees it; a false positive shows up as an obviously wrong card
 * that is easy to spot and remove. The hard filters and the star floor do most
 * of the work, and everything here is labelled unreviewed anyway.
 */
export const MIN_RELEVANCE = 0.4

/** Any single one of these means the repo is read, not run. Hard reject. */
export function isDisqualified(relevance: Relevance): boolean {
  return relevance.negativeHits.length > 0
}
