# OSS for Founders

A filterable catalogue of open-source tools that startup founders can actually run. Free, no
login, no paywall, no paid APIs.

There is no backend and no database. Every entry lives in `data/repos.json` (curated) or
`data/discovered.json` (auto-imported), and the site makes no network calls at runtime.

## Status

Stages 1–6 are built: the catalogue, 13 category pages, search and filters, a keyword assistant,
hidden gems with transparent scoring, full detail pages, and the local-only extras (saved repos,
compare, stacks).

**The discovery import has run.** The catalogue holds 4,906 repos: 49 curated and 4,857
auto-discovered, across all 13 categories, with 236 flagged as hidden gems. Only 2 entries have
a written review — see [Adding a curated repo](#adding-a-curated-repo) for why that is the part
worth working on. The run is documented in `data/discover-report.md`.

## Getting started

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. The component inventory is at `/design`, which renders every
base component in light and dark side by side.

No configuration is needed to run the site: the catalogue is committed JSON and the site makes
no network calls at runtime.

### Environment variables

Only the build scripts need any. Copy the template and fill in what you need:

```bash
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
```

| Variable                       | Needed by                                              |
| ------------------------------ | ------------------------------------------------------ |
| `GITHUB_TOKEN`                 | `discover`, `refresh-stats`; optional for `add-repo`    |
| `NEXT_PUBLIC_SITE_URL`         | Canonical links, OG tags, sitemap, robots — set on deploy |
| `NEXT_PUBLIC_ASSISTANT_ENGINE` | Optional; only `keyword` is implemented                 |

`.env` is gitignored; `.env.example` is committed and holds no secrets. A real environment
variable always beats the file, so CI does not need one.

The scripts load `.env.local` and then `.env` themselves via `lib/env.ts` — tsx does not do it
automatically, and without that a token sitting in `.env` would be silently ignored while the
script kept insisting it was missing.

## Scripts

| Script                  | What it does                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `npm run dev`           | Dev server                                                   |
| `npm run build`         | Validate data, rebuild the search index, then `next build`    |
| `npm run build:only`    | `next build` alone, skipping the data gate                   |
| `npm run lint`          | ESLint                                                       |
| `npm run typecheck`     | `tsc --noEmit`                                               |
| `npm run validate`      | Validates both data files and `stacks.json` against the schemas |
| `npm run build:index`   | Writes `public/search-index.json`                            |
| `npm run refresh-stats` | Refreshes GitHub stats for curated repos (needs a token)     |
| `npm run discover`      | Runs the discovery import (needs a token)                    |
| `npm run add-repo`      | Adds one curated repo, reading its facts from the API        |
| `npm run build:embeddings` | Re-embeds the catalogue into `data/embeddings.json`       |
| `npm run test:assistant`   | Scores the assistant against 60 founder queries           |

`npm run build` fails if the data does not match the schema. That is deliberate: a broken entry
should stop a deploy, not render a broken card.

## Routes

| Route               | What it is                                                     |
| ------------------- | -------------------------------------------------------------- |
| `/`                 | Headline, assistant box, categories, stacks, recently added    |
| `/explore`          | Everything, with filters and sort held in the URL              |
| `/ask`              | The assistant. Also a slide-over from the nav and home page    |
| `/c/[slug]`         | One category, filterable, 24 per page (`?page=2`)              |
| `/r/[owner]/[name]` | One repo in full. `/r/[id]` permanently redirects here         |
| `/gems`             | Hidden gems, with the scoring shown per entry                  |
| `/stacks`           | Curated sets of tools that work together                       |
| `/compare?ids=…`    | Up to three repos side by side                                 |
| `/saved`            | Bookmarks and recently viewed, from this browser only          |
| `/submit`           | Opens a prefilled GitHub issue                                 |
| `/design`           | Component inventory, light and dark side by side               |

## Adding a curated repo

One command. Every fact is read from the GitHub API, so nothing can be typed from memory:

```bash
npm run add-repo -- supabase/supabase saas-development
npm run add-repo -- https://github.com/documenso/documenso productivity-automation
```

Flags: `--gem` (hidden gem), `--pick` (editor's pick), `--dry-run` (print, don't write),
`--force` (add despite a failed check). It works without a token; one request fits the
unauthenticated budget.

It refuses a repo that is archived, disabled, a fork, has no description, has had no push in a
year, or has **no LICENSE file at all** — the last one means all rights reserved by default, so
nobody can legally run it.

It *allows*, with a warning, a repo whose licence GitHub cannot map to an SPDX id. That is
usually open-core or source-available, which is how a lot of the best founder tooling ships
(PostHog, Sentry, n8n). Those entries show no licence and the detail page tells the reader to go
and read it. Check it yourself before recommending one.

It also follows renames. Ask for `calcom/cal.com` and it records `calcom/cal.diy`, because that
is what the API returns.

### Then write it up

A new entry is `reviewed: false` and shows as **Not reviewed yet** — facts only, no write-up.
That is the honest default, and it is also the thing worth fixing: the facts are already on
GitHub, so the review is the only part of this site GitHub does not already give you.

Open `data/repos.json`, find the entry, and add:

```jsonc
"reviewed": true,
"whyFounders": "What it saves a founder, in one or two plain sentences.",
"difficulty": "intermediate",
"selfHostable": true,
"installHint": "The command you actually ran.",
"pros": ["Specific, checkable claims"],
"cons": ["The real objection, not a token one"],
"alternatives": ["What you would otherwise pay for"]
```

Then `npm run validate`. It rejects `reviewed: true` with no editorial content, so the badge
cannot lie.

### What makes a repo worth adding

- **A founder can run it.** Self-hostable, or embeddable in their own product. Not a library.
- **It replaces something they would otherwise pay for**, or removes work they would otherwise
  do. That is the whole premise of the catalogue.
- **It is maintained.** A year without a commit is the cutoff, and the card says "Possibly
  stale" well before that.
- **Its licence is legible.** Not necessarily permissive — AGPL is fine and the site says so —
  but someone has to be able to tell what they are agreeing to.

What to leave out: awesome-lists and link collections, courses and tutorials, boilerplates and
starter templates, language SDKs and API wrappers for a third-party service, and anything in
payments or billing (there is deliberately no category — self-hosting card processing means
inheriting PCI scope).

### Adding a lot at once

For volume rather than individual picks, use the discovery import below. The trade-off is
explicit: it adds hundreds of repos with real facts and **no** editorial content, all labelled
unreviewed. Volume is cheap; the write-ups are what people come for.

## Running discovery

Discovery needs a token. A classic token with **no scopes** is enough — it only reads public data:

```bash
export GITHUB_TOKEN=ghp_...          # PowerShell: $env:GITHUB_TOKEN = 'ghp_...'

npm run discover -- --test           # 20 per category, then stop
# read data/discover-report.md, tighten data/category-map.json if you see junk
npm run discover                     # full run, capped at 3,000
npm run validate
```

`npm run discover -- --resume` continues an interrupted run from
`data/.discover-state.json`. `--no-readme` skips the per-candidate README check, which is one
request per candidate.

What it does, in order:

1. Calls `/rate_limit` once to prove the token works. A bad or expired token
   fails here with an explanation, not on request 400 of a long run.
2. Searches every topic and keyword in `data/category-map.json` — about 300 terms —
   each split across five star bands (`200..499`, `500..1000`, `1001..3000`,
   `3001..10000`, `>10000`). Any band that would exceed the search index's
   1,000-result ceiling is split again across four pushed-date windows.
3. Uses the **GraphQL API**, which returns a page of repos with every field
   needed *including whether a README exists* — that alone removes one REST
   call per candidate. REST search is the automatic fallback if GraphQL fails.
4. Filters, scores, ranks, and writes `data/discovered.json`.

Rate limits are never fatal. A 403, 429, or GraphQL `RATE_LIMITED` is handled by
reading `retry-after` and `x-ratelimit-reset`, sleeping, and retrying the same
page. Progress is checkpointed to `data/.discover-state.json` every few queries,
so `--resume` picks up where it stopped.

### What survives the filter

- **Stars >= 500**, relaxed to **200** only for a hidden gem scoring >= 0.80
- Not a fork, not archived, not disabled
- Has a licence GitHub can resolve, and a description
- Pushed within 12 months, and created more than 6 months ago
- Quality score >= 0.55 and **founder relevance** >= 0.40

Founder relevance (`lib/founder-relevance.ts`) is a separate judgment from
quality, because the two disagree constantly: a well-maintained Kubernetes
operator scores ~0.95 on quality and is useless to someone choosing a help desk.
It looks for the jobs a founder actually has — SaaS backends, CRM, helpdesk,
analytics, auth, e-commerce, CMS, automation, internal tools, AI apps, email,
forms, project management, docs — and rejects anything that reads as something
you study rather than run: awesome-lists, tutorials, courses, books, dotfiles,
interview prep, research, demos, boilerplates, and vendor SDKs.

Only real API data is stored. Descriptions are copied verbatim and never
rewritten, and no review, pro, con, or difficulty is ever generated for a discovered repo.

### The weekly Action

`.github/workflows/discover.yml` runs the refresh and the import every Monday using the
workflow's built-in `GITHUB_TOKEN`, then opens a pull request with the changed data files and the
report as the PR body. Nothing reaches the site until someone reads that diff. It can also be
triggered by hand from the Actions tab, with a test-run checkbox.

## Deploying free on Vercel

1. Push the repo to GitHub.
2. On [vercel.com](https://vercel.com), **Add New → Project**, and import it. The framework is
   detected; no build settings need changing.
3. Set one environment variable: `NEXT_PUBLIC_SITE_URL` = your production URL (for example
   `https://example.vercel.app`). Canonical links, Open Graph tags, `sitemap.xml`, and
   `robots.txt` use it; without it they fall back to `http://localhost:3000`.
4. Deploy.

There is no database, no server-side secret, and no paid API, so the free Hobby tier is enough.
`GITHUB_TOKEN` is only needed in CI for the weekly import, not at runtime.

## How the assistant works

The chatbox does not search for the words you type. It searches for the *kinds of tool* your
goal implies, which is a different thing and the reason it was rebuilt.

"I want to improve my ui ux of my website" contains exactly one noun a keyword engine can grab
— "website" — and it is the least informative word in the sentence. Every repo that serves a
web page mentions it. So that message now resolves to six searches instead of one: component
libraries, animation, icons, design systems, accessibility testing, and product analytics.

Four steps, in `lib/assistant`:

1. **Understand** (`plan.ts`, `needs.ts`). The message is resolved to needs from a taxonomy of
   ~57, via named products ("alternative to Notion"), goal patterns ("users keep leaving"), and
   stemmed keyword scoring. Words describing what you already own — website, app, product,
   startup, platform — are stopwords and never reach the search layer. With `LLM_API_KEY` set,
   an LLM does this step instead and its needs are mapped back onto taxonomy keys where they fit.
2. **Retrieve** (`retrieve.ts`). Each need is searched separately: cosine similarity against
   MiniLM embeddings built at build time, blended 62/38 with BM25 over name, topics, category
   and description. Embeddings alone drift to whatever is vaguely on-topic; BM25 alone is the
   word matching this replaced. Results are merged round-robin into 40 candidates.
3. **Rerank and explain** (`pipeline.ts`). With a key, the LLM is shown the goal and the
   candidates — id, name, description, topics, stars, licence, last updated — and returns up to
   3 ids per need with a one-sentence reason drawn only from those fields.
4. **Verify** (`pipeline.ts`). Every id the model returns is looked up in the catalogue and
   dropped if it is not there, or if it was attached to a need it was not retrieved for. A model
   cannot introduce a repo, only reorder and describe the ones retrieval found.

**It works with no API key.** Without one, steps 1 and 2 run locally and reasons are assembled
from fields. That path scores 58/60 on `npm run test:assistant`, so the key buys free-form
understanding of questions the taxonomy has no pattern for, and better-written reasons — not
correctness.

Model defaults were picked by probing a real key, not from memory: `gemini-flash-lite-latest`
for Gemini, because on a free-tier key the bigger flash models returned 503 "high demand" about
half the time while lite answered every call in 1-3s. A pinned version also ages out — the
first default here, `gemini-2.0-flash`, is now a 404. If a call fails the server logs the
reason and the answer falls back to the local engine, so the site never breaks over it.

`LLM_API_KEY` and `LLM_PROVIDER` have no `NEXT_PUBLIC_` prefix and are read only inside
`app/api/ask/route.ts`. The key never reaches the browser. `lib/assistant/llm.ts` throws on
import if `window` exists, so a mistake there fails loudly instead of shipping a key.

### Re-embedding

`data/embeddings.json` (2.5MB, int8-quantised) is committed and is **not** rebuilt by
`npm run build` — it takes about four minutes. Run `npm run build:embeddings` after changing
the catalogue or the need taxonomy. Retrieval degrades to BM25-only if the file is missing or
no longer covers the catalogue, rather than failing.

## The data contract

`lib/schema.ts` holds a Zod schema that is the single source of truth. The TypeScript `Repo` type
is inferred from it, so the compile-time shape and the runtime validator cannot drift apart.

`npm run validate` checks more than the types can:

- both data files are valid JSON and match the schema
- `id` values are unique across both files, and no file lists one repo twice
- for `github.com` URLs, the URL agrees with `owner` and `name`
- no duplicate tags within an entry
- an entry marked `reviewed` actually has editorial content
- `stats.pushedAt` is not later than `stats.fetchedAt`
- every category has at least one entry
- every repo referenced by `data/stacks.json` exists in the catalogue

### Facts vs. editorial

**Facts** come from the GitHub API and nothing else: `owner`, `name`, `url`, `description`, and
everything in `stats`. Descriptions are quoted verbatim, with one normalization — decorative
emoji are stripped (® ™ © are kept), because a leading emoji in a card title is
emoji-as-iconography, which the design rules ban.

**Editorial** fields are judgment: `whyFounders`, `problemSolved`, `features`, `useCases`,
`pros`, `cons`, `difficulty`, `selfHostable`, `installHint`, `alternatives`, `techStack`,
`isEditorPick`, `isHiddenGem`. All optional, and most entries have none of them. Every surface
renders that empty case and says so rather than hiding the repo or inventing content.

Two flags describe provenance, and they mean different things:

- `source` — which process produced the entry: `curated` (hand-picked) or `auto-discovered`.
- `reviewed` — whether a human wrote the editorial fields.

They are independent. `repos.json` is hand-picked but not hand-written: 37 of its 39 entries are
`curated` and unreviewed, and the UI labels those "Not reviewed yet".

### Stats and staleness

Stats may only be committed inside the `stats` object, which requires a `fetchedAt` date. A star
count in a JSON file is wrong the next day; the timestamp is what makes shipping one honest, and
the UI always shows it. Do not add a stat field outside that object.

"Possibly stale" means no commits in the 12 months **before `fetchedAt`**, not before now. Both
dates are in the data, so the verdict is deterministic — which it has to be, because under Cache
Components a clock read during prerender is a build error.

Fields GitHub does not report are absent, not guessed. Several entries carry a custom or dual
licence the API reports as `NOASSERTION`, so they show no licence and the detail page says to
check the repo.

### The quality score

`lib/scoring.ts` defines six weighted components — recent activity, adoption, description and
topics, README presence, licence clarity, and issue health. Each is 0–1, the breakdown is stored
on every entry, and `/gems` shows it.

Adoption is one log-scaled component out of six, so a documented 200-star project outscores an
abandoned 40k-star one. Low star counts never qualify a hidden gem on their own: a candidate has
to clear the score first, and the star band is applied last.

## Design rules

Neutral palette plus one accent (blue), which lives on `--primary` and `--ring`. No gradients,
glassmorphism, glow, or emoji icons. 1px borders rather than heavy shadows. Geist for prose,
Geist Mono for stats, tags, and commands. Left-aligned and dense.

`Badge` carries status and metadata. `Tag` carries taxonomy keywords and is always mono.

## Layout

```
app/
  (site)/      the public site
    page.tsx       homepage
    explore/       everything, filterable
    ask/           the assistant
    c/[slug]/      category pages
    r/[...slug]/   repo detail; 1 segment redirects to owner/name
    gems/ stacks/ compare/ saved/ submit/
    not-found.tsx  404, inside the layout so it keeps the chrome
  (design)/    component inventory, pinned to the light theme
  sitemap.ts robots.ts
components/
  ui/          shadcn/ui primitives
  chat/        the assistant panel and slide-over
  design/      the component gallery
data/
  repos.json        curated entries
  discovered.json   auto-imported entries ([] until the import runs)
  category-map.json topics and keywords that drive discovery
  stacks.json       curated stacks, referencing repos by owner/name
  github-cache.json API snapshot, the fallback when offline or rate limited
lib/
  data/        the merge layer: every page reads from here
  assistant/   recommendation engine, synonyms, stack roles
  schema.ts    Zod schema, the single source of truth
  scoring.ts   the quality score and its weights
  github.ts    REST client for the build scripts (never imported by a page)
  format.ts    number and date formatting, clock-free by contract
scripts/       validator, stats refresh, discovery, search index
```

`lib/data` merges the two files on the GitHub path, with curated winning on conflict, so the
import can add thousands of entries without touching page code.

`(site)` and `(design)` are separate route groups with their own root layouts. `/design` needs a
light document root so it can nest a `.dark` subtree and show both themes at once, which is why
it is isolated.

See `PROJECT_GUIDE.md` for implementation notes that are easy to get wrong, and `NOTES.md` for the
assumptions made while building.
