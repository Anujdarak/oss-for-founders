/**
 * Scores the assistant against tests/assistant-queries.json.
 *
 * Runs the retrieval engine directly rather than through the HTTP route, so
 * it measures the part that decides *which repos come back* without needing a
 * server or an API key. The LLM layers on top of this reorder and explain; if
 * retrieval is wrong, no amount of reranking saves the answer.
 *
 *   npm run test:assistant              summary plus failures
 *   npm run test:assistant -- --verbose every query
 *   npm run test:assistant -- --query "improve my ui ux"   one ad-hoc query
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { answerFromPlan, mergePlans, understand, withNamedRepos } from "../lib/assistant/pipeline"
import { planLocally } from "../lib/assistant/plan"
import { loadCorpus, retrieve } from "../lib/assistant/retrieve"

type Case = { q: string; expect: string[]; needs?: string[] }

type RepoCase = {
  q: string
  anyOf?: string[]
  allOf?: string[]
  never?: string[]
  /** A model-written plan, replayed: [label, search phrase] pairs. */
  llmNeeds?: [string, string][]
}

const TOP_N = 3
/** A query passes when at least this many of the top N are in `expect`. */
const NEEDED = 2

const args = process.argv.slice(2)
const verbose = args.includes("--verbose")
const adhocIndex = args.indexOf("--query")
const adhoc = adhocIndex >= 0 ? args[adhocIndex + 1] : null

function topFor(query: string) {
  const plan = planLocally(query)
  const { candidates } = retrieve(plan)
  return { plan, candidates }
}

if (adhoc) {
  const { plan, candidates } = topFor(adhoc)
  console.log(`\nquery:  ${adhoc}`)
  console.log(`goal:   ${plan.goal}`)
  console.log(`needs:  ${plan.needs.map((n) => n.key).join(", ") || "(none)"}`)
  if (plan.needsClarification) console.log(`clarify: ${plan.clarifyingQuestion}`)
  console.log("")
  for (const [i, hit] of candidates.slice(0, 10).entries()) {
    console.log(
      `  ${String(i + 1).padStart(2)}. ${(hit.doc.owner + "/" + hit.doc.name).padEnd(34)} ` +
        `${hit.doc.category.padEnd(24)} need=${hit.needKey.padEnd(18)} ` +
        `score=${hit.score.toFixed(3)} cos=${hit.cosine.toFixed(3)} bm25=${hit.lexical.toFixed(2)}`
    )
  }
  process.exit(0)
}

const file = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "assistant-queries.json"), "utf8")
) as { queries: Case[]; repoQueries?: RepoCase[] }

const cases = file.queries
let passed = 0
const failures: string[] = []

const started = Date.now()

for (const testCase of cases) {
  const { plan, candidates } = topFor(testCase.q)
  const top = candidates.slice(0, TOP_N)
  const expected = new Set(testCase.expect)
  const hits = top.filter(
    (candidate) =>
      expected.has(candidate.doc.category) ||
      (candidate.doc.secondaryCategory && expected.has(candidate.doc.secondaryCategory))
  ).length

  const ok = hits >= NEEDED
  if (ok) passed += 1

  const line =
    `${ok ? "pass" : "FAIL"}  ${hits}/${TOP_N}  ${testCase.q}\n` +
    `        needs: ${plan.needs.map((n) => n.key).join(", ") || "(none)"}\n` +
    top
      .map(
        (candidate) =>
          `        - ${(candidate.doc.owner + "/" + candidate.doc.name).padEnd(32)} ` +
          `${candidate.doc.category}${expected.has(candidate.doc.category) ? "" : "  <- unexpected"}`
      )
      .join("\n")

  if (verbose) console.log(line)
  if (!ok) failures.push(line)
}

if (!verbose && failures.length > 0) {
  console.log("Failures\n========")
  for (const failure of failures) console.log(failure + "\n")
}

const rate = ((passed / cases.length) * 100).toFixed(1)
console.log(
  `\n${passed}/${cases.length} passed (${rate}%)  ` +
    `[top ${TOP_N}, need ${NEEDED} in expected categories]  ` +
    `${((Date.now() - started) / 1000).toFixed(1)}s`
)

// 54/60 is the agreed bar.
const THRESHOLD = Math.ceil(cases.length * 0.9)
if (passed < THRESHOLD) {
  console.error(`below threshold: needed ${THRESHOLD}/${cases.length}`)
  process.exitCode = 1
}

/**
 * Specific repos, through the real answer path.
 *
 * The category check above passes when two of the top three are in the right
 * shelf, which is how it stayed green while asking for "ollama" by name did
 * not return ollama. These cases name the repo. Unlike the category bar,
 * every one of them must pass.
 */
async function runRepoCases(): Promise<void> {
  const repoCases = file.repoQueries ?? []
  if (repoCases.length === 0) return

  // A case naming a repo that is not in the catalogue would pass or fail for
  // the wrong reason, so that is a failure in itself.
  const { byId } = loadCorpus()
  let repoPassed = 0

  for (const testCase of repoCases) {
    const named = [...(testCase.anyOf ?? []), ...(testCase.allOf ?? []), ...(testCase.never ?? [])]
    const missing = named.filter((id) => !byId.has(id))

    const plan = testCase.llmNeeds
      ? withNamedRepos(
          mergePlans(planLocally(testCase.q), {
            needs: testCase.llmNeeds.map(([label]) => label),
            search_queries: testCase.llmNeeds.map(([, query]) => query),
          }),
          testCase.q
        )
      : await understand(testCase.q, [], [])
    const answer = await answerFromPlan(testCase.q, plan, [])

    // Top 3 of the answer as a reader sees it: the first group's items first.
    const shown = answer.groups.flatMap((group) => group.items.map((item) => item.doc.id))
    const top = shown.slice(0, 3)

    const problems: string[] = []
    if (missing.length > 0) problems.push(`not in catalogue: ${missing.join(", ")}`)
    if (testCase.anyOf && !testCase.anyOf.some((id) => top.includes(id))) {
      problems.push(`none of ${testCase.anyOf.join(", ")} in top 3`)
    }
    for (const id of testCase.allOf ?? []) if (!top.includes(id)) problems.push(`${id} not in top 3`)
    for (const id of testCase.never ?? []) if (shown.includes(id)) problems.push(`${id} shown`)

    const ok = problems.length === 0
    if (ok) repoPassed += 1
    const mode = testCase.llmNeeds ? "llm-plan" : "local"
    if (verbose || !ok) {
      console.log(
        `${ok ? "pass" : "FAIL"}  [${mode}] ${testCase.q}
        top: ${top.join(", ") || "(nothing)"}` +
          (ok ? "" : `
        ${problems.join("; ")}`)
      )
    }
  }

  console.log(`
${repoPassed}/${repoCases.length} repo cases passed  [every one must pass]`)
  if (repoPassed < repoCases.length) process.exitCode = 1
}

runRepoCases().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
