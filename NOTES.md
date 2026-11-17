# Notes and assumptions

Decisions made while building Stages 3-6 without stopping to ask. Each one is a
judgment call that could reasonably have gone the other way.

## Discovery rewrite (token now available)

A working `GITHUB_TOKEN` arrived, so the import was rebuilt and actually run.
Four things were learned by running it rather than by reasoning about it.

- **GraphQL cannot do `first: 100` for this query.** It returns 502 or 504 every
  single time. Isolating it showed the README fields were not the cause: it
  times out with no README fields, and with the issue count removed as well.
  50 works reliably and still costs one rate-limit point, so the page size is
  50 with an automatic drop to 25 on a gateway error. The README check was
  trimmed from four filename variants to two for the same reason.
- **Paging depth is worth far less than query breadth.** At 45 pages per slice a
  single broad term (`topic:llm`) spent nine minutes walking twelve date
  windows, which would have put the 1,510-query run into the many-hours range.
  GitHub returns search results best-match first and the terms overlap heavily,
  so the deep pages were mostly repeats of what other terms already found.
  Settled at 6 pages per slice and 4 date windows.
- **A page budget set in pages, not results, silently truncates.** With the
  budget at 20 pages and the client degraded to 25 per page, every medium query
  returned exactly 500 results and stopped — losing up to half of what was
  available, with nothing in the output to say so.
- **The quality score cannot rank anything.** It sits between 0.85 and 0.89 for
  almost everything that survives the hard filters, because those filters
  already require a licence, a description, recent activity and a README. The
  cap now ranks on founder relevance first, with quality and log-scaled stars
  only breaking ties. Before that change the top 25 contained an AI-shorts
  generator and a repo called `locally-uncensored`.

`lib/founder-relevance.ts` is the new piece: it answers "is this a tool a
founder could run" separately from "is this well maintained", because the two
disagree constantly. A well-maintained Kubernetes operator scores ~0.95 on
quality and is useless to someone choosing a help desk.

### Two more found by running it at full scale

- **Sequential requests were the whole bottleneck.** A measured run managed 1.3
  queries a minute while using 80 of 5,000 GraphQL points an hour — essentially
  all of the time was spent waiting on GitHub. Six concurrent workers took it to
  ~50 queries a minute, a 38x speed-up, and the full import finished in minutes
  rather than the projected three hours.
- **Query order decided category coverage.** Terms were grouped by category, so
  any early stop, timeout, or interruption would have produced a catalogue of
  nothing but AI tools. `buildTerms` now interleaves categories round-robin, so
  stopping at any point leaves balanced coverage. This was caught before the
  real run, by noticing the state file showed 2 of 13 categories after 10
  queries.

### Result, and its known tail

12,213 unique repos seen, 4,857 written, 7,356 dropped. GraphQL only: 1,155
requests for 1,154 of 5,000 points, no REST fallback needed.

The gem thresholds were recalibrated **after** the run, because they were set
against a 39-repo catalogue and flagged 52% of a real one. Details in
`data/discover-report.md`; the short version is that a 0.80 score floor sits
below the median score of 0.905, and a 200-2,000 star band straddles the median
star count of 1,434. Now 200-1,000 stars and >= 0.92, which flags 4.7%.

What is *not* fixed, and should be said plainly: mechanical discovery has a
visible tail of misclassification. Spot-checking `customer-support` turned up
Logseq, a voice model, and an instant-messaging client — all of which matched a
single support-flavoured topic and won the category vote on one vote. A couple
of flagged gems are explicitly libraries (`g3log`, `kalendar`) that the library
filter missed because their descriptions are marketing copy. E-commerce, by
contrast, is almost perfectly clean.

Every discovered entry is labelled **Not reviewed yet** and carries no written
review, pros, cons, or difficulty, so none of this is presented as vetted. The
tail is a reason to review entries before promoting them, not a reason to
distrust the facts, which all came from the API.

Also switched env loading to `dotenv` and added a `/rate_limit` preflight, so a
bad or expired token fails in the first second with an explanation rather than
on request 400 of a long run.

## Historical: no GITHUB_TOKEN in this environment

`GITHUB_TOKEN` was not set, and the unauthenticated REST API allows 60 requests
per hour. Consequences, stated plainly:

- **The full discovery import never ran.** `data/discovered.json` is `[]`. Every
  repo on the site is one of the 39 curated entries. `scripts/discover.ts` is
  complete and its filter/score pipeline was tested against live search results
  on a small sample (see `data/discover-report.md`), but the 3,000-repo run
  needs a token.
- **`npm run refresh-stats` could not fetch.** It fell back to
  `data/github-cache.json` exactly as designed, which is itself real API data:
  all 39 curated repos were read from the live API on 2026-11-06 while seeding.
- Both scripts fail with an explicit setup message when the token is missing,
  which is the specified behaviour.

**To finish this yourself:** `export GITHUB_TOKEN=ghp_...` (no scopes needed),
then `npm run refresh-stats -- --force` and `npm run discover -- --test`, read
`data/discover-report.md`, then `npm run discover`.

Everything that depends on having thousands of repos — pagination past page 1,
filter facets with wide ranges, Lighthouse at 3,000 entries — is therefore
written and unit-checked against synthetic volume rather than observed in
production. Those checks are called out where they occur.

## Stage 3

- **`review` became `source` + `reviewed`.** Stage 2 had a single `review` enum.
  Stage 3's spec named `source: "auto-discovered"` and `reviewed: false`
  separately, so the schema now carries both and `review` is gone.
- **Three review labels, not two.** `reviewed` → "Editor-reviewed";
  `auto-discovered` and unreviewed → "Auto-discovered"; curated but unreviewed →
  "Not reviewed yet". The 37 hand-picked Stage 2 entries fall in that third case:
  calling them "Auto-discovered" would be false, and "Editor-reviewed" more so.
- **Stats live only inside the `stats` object, which requires `fetchedAt`.** This
  reverses Stage 1's "never commit a star count" rule. The number still rots; the
  timestamp is what makes shipping it honest, and the UI always shows it.
- **"Possibly stale" is measured against `fetchedAt`, not now.** Under Cache
  Components a clock read during prerender is a build error, and a relative date
  baked into static HTML would be wrong by the time anyone read it.
- **Avatars are stored but barely used.** The spec asked for the avatar field;
  the design rules ask for a dense, non-decorative look. Compromise: fetched and
  stored, shown only on detail pages.
- **The build validates data.** `npm run build` runs `npm run validate` first, so
  a schema violation fails the build. `npm run build:only` skips it.
- **Filters were tightened after a real test import, not before.** Five
  query/star-range combinations were run against live search, the kept list was
  read by hand, and four classes of junk drove config changes — including two
  exclusion rules that were removing legitimate tools. `data/discover-report.md`
  records what changed and why.
- Discovery scoring is deliberately not a popularity ranking: adoption is one
  log-scaled component of six, so a well-documented 200-star project outscores an
  abandoned 40k-star one.

## Stage 4

- **Filters run on the server, the assistant runs in the browser.** Filtering and
  sorting are pure URL state resolved during rendering, so a filtered view is
  linkable and prerenderable and ships no JavaScript. The assistant has to be
  client-side, so it fetches a prebuilt `public/search-index.json` on first use
  rather than being inlined into a page payload — at 3,000 repos that file is
  megabytes, and nobody landing on the home page should pay for it.
- **The assistant is keyword retrieval, not a model**, and the UI says so. It can
  only return rows from the data files. `getRecommendations` sits behind an
  `Engine` interface selected by `NEXT_PUBLIC_ASSISTANT_ENGINE`, so an LLM
  engine can be dropped in without touching the UI.
- **Tuned against real output, not by guesswork.** Running the four suggested
  prompts through the engine exposed four bugs worth recording:
  - "Auth for a SaaS" produced a seven-layer stack answer, because `a saas`,
    `web app`, `mvp` and `side project` were treated as build intent. The
    stack-detection list now requires an explicit build verb.
  - Fuse at `threshold: 0.4` / `minMatchCharLength: 2` matched the "aaS" in
    "PaaS" for "SaaS" and the "aut" in "mautic" for "Auth". Now 0.32 / 3.
  - "Why this matches" quoted fragments like "ing" and "aaS". Quoted terms now
    need four characters and a word boundary.
  - Searching the raw sentence meant "Open-source alternative to Intercom"
    matched every repo calling itself open-source. The engine now searches
    extracted keywords, and hyphenated filler is in the stopword list.
- **Payments and billing answer honestly.** Asking for Stripe alternatives gets a
  plain "this catalogue has no payments category" rather than a weak match from
  a neighbouring one.
- **`beginner-friendly` currently matches nothing**, because `difficulty` is an
  editorial field and only two entries are reviewed. The filter renders with a
  count of 0 rather than being hidden: an empty facet is a fact about the data.
- Known rough edge: a nonsense query ("quantum teleportation device driver")
  returns one weak fuzzy hit instead of nothing, because "driver" partially
  matches "drive". Tightening further started removing real matches, so it was
  left — the no-match path itself is exercised and works.

## Stage 5

- **One catch-all route, not two.** `/r/[id]` and `/r/[owner]/[name]` cannot
  coexist: Next rejects two different slug names at the same path position. So
  `/r/[...slug]` handles both — two segments render the page, one segment is
  treated as a legacy id and `permanentRedirect`s to the canonical URL. Old links
  keep working. `/hidden-gems` likewise 308s to `/gems` via `next.config.ts`.
- **Curated entries now carry a score too.** `/gems` promises a transparent
  breakdown, and the curated hidden gems had none because only `discover.ts`
  scored anything. They are now scored with the identical formula, using each
  entry's own `stats.fetchedAt` as "now" so the result is deterministic. Observed
  range across the 39: 0.847–1.00, which is more evidence the score ranks rather
  than filters.
- **The five dimensions in the brief map onto six stored components.** "Docs
  quality" is `readme` plus `metadata`, "maintenance" is `activity` plus
  `issueHealth`, "licence clarity" is `license`, and "discovery score" is the
  weighted total. **"Founder relevance" is deliberately not a number** — no
  formula produces it. The page says it is an editorial call present only on
  reviewed entries, rather than inventing a figure to fill the slot.
- **Gem sections are split by review status, not by source.** The brief named
  "Editor-reviewed" and "Auto-discovered candidates"; since the import has not
  run, all six gems are hand-picked but unreviewed. They appear under
  "Candidates — not reviewed", which is what they actually are.
- **Unreviewed detail pages keep the section, lose the content.** Pros, cons and
  the write-up are not hidden and not generated: the page states that nobody has
  written it up and that everything shown came from the API.
- JSON-LD uses `SoftwareApplication` and emits only fields backed by data — no
  `aggregateRating` or price, since the site has neither ratings nor prices.
- "Similar repos" ranks same-category first, then shared topic count. No
  embeddings, nothing learned — just set overlap.

## Stage 6

- **Local state uses `useSyncExternalStore`, not `setState` in an effect.** The
  first version did the latter and ESLint rejected it; Stage 1's `useHydrated`
  had already established the right pattern, with a comment saying exactly why.
  Snapshots are cached in `lib/local-store.ts` because that hook requires a
  stable reference between changes — returning a freshly parsed array each call
  re-renders forever.
- **Scaling was measured, not assumed.** A synthetic 3,000-entry
  `discovered.json` was generated locally, built, measured, and deleted. Two
  real problems surfaced:
  - Prerendering every repo page took **over ten minutes** and was still going
    at 1,536 of 3,073 pages. `generateStaticParams` on the repo route now
    prerenders 300 pages — reviewed entries and hidden gems first, then the
    most-starred — and the rest render on first request and persist. Build went
    to **83 seconds** at 3,039 entries.
  - `/gems` rendered every gem with no pagination, and each row carries a score
    breakdown. It was already 150 KB with six entries. The candidates section is
    now paginated at 24.
  - Measured at 3,039 entries afterwards: catalogue pages 87–94 KB, client JS
    839 KB across 20 chunks, search index 1.45 MB but fetched on demand only.
- **Lighthouse was not run.** No headless browser was available here, so the
  "90+ at 3,000 repos" target is supported by the payload measurements above
  rather than a score. Worth running once the real import has populated the data.
- `/saved` and `/compare` are `noindex` and disallowed in `robots.txt`: one is
  per-person and empty without someone's local storage, the other is infinite
  query permutations of pages already indexed.
- The sitemap's `lastModified` comes from each entry's `stats.pushedAt`, not the
  build clock — a clock read there is a build error under Cache Components, and
  "everything changed at deploy time" tells a crawler nothing.
- **Stacks reference repos by `owner/name`, never by copy**, so a stack cannot
  drift from the entry it points at. The validator fails the build on a
  reference the catalogue does not have; that check was tested by injecting a
  bad reference and confirming it failed.
- The three stacks are editorial groupings of repos already in the catalogue.
  The role notes are judgment; no repo, stat, or description was invented.
- The OG image uses system font stacks only. Fetching a webfont would make the
  build depend on the network.
- Design audit: no gradients, glow, heavy shadows, emoji icons, or hype words in
  any UI copy, and no hardcoded colours outside the dialog scrim that Stage 1's
  `ui/dialog.tsx` already used. `/design` stays `noindex`.

## Motion pass

Added with Framer Motion (`motion` v14) plus CSS transitions for simple hovers.
Ground rules held throughout: `transform` and `opacity` only, 150-400ms,
ease-out or a non-overshooting spring, and every animation has a
reduced-motion path.

`lib/motion.ts` holds the shared vocabulary so durations and easing cannot
drift apart across components, and `components/motion/reveal.tsx` holds thin
client wrappers.

**Why wrappers rather than animating components directly:** the catalogue pages
are server components over ~4,900 repos. Marking `RepoCardGrid` as a client
component to fade a card in would ship the whole catalogue to the browser.
Instead only the wrapper is `"use client"` and `children` arrive as
already-rendered server output.

### Phase 1 — page and load motion

- Route transitions: enter only, no exit. An exit animation holds the old page
  on screen while the new one is already ready, which makes every navigation
  slower to *feel* for no benefit. 6px rise rather than the usual 10, because a
  whole page moving reads much larger than one card moving.
- Hero runs as a staggered sequence: headline and subhead, then the search bar,
  then the links.
- Category rows, repo cards and the recently-added list stagger in on scroll at
  40ms apart, `once: true`. Re-animating on every scroll past makes a long page
  feel unstable, and at 4,900 repos there is a lot of scrolling.
- Reduced motion returns the same variants with movement removed and a 10ms
  fade, rather than disabling animation. One code path means a component cannot
  get stuck rendering its hidden state.

### Phase 2 — hover and press

Done in CSS rather than JS. These fire on every pointer move, and a compositor
transition costs nothing where a React re-render would.

- A global `prefers-reduced-motion` block in `globals.css` collapses every CSS
  transition and animation on the site, including `scroll-behavior`. The
  durations go to 0.01ms rather than `none` so transition events still fire.
- Repo cards lift 2px and their ring goes from `foreground/10` to
  `foreground/20`. Transform only, so a lifting card cannot nudge its
  neighbours.
- `active:translate-y-px` was already on the shared Button from shadcn, so
  press feedback existed everywhere and needed nothing.
- Arrow and external-link icons shift a couple of pixels toward where they are
  about to take you.
- `link-underline`: an underline drawn as a pseudo-element and animated with
  `scaleX`, wiping in from the left. It cannot shift the text above it, which
  a `border-bottom` or `text-decoration` toggle would.
- Category icons scale to 1.1 on row hover.

### Phase 3 — interface motion

- **Sliding tab indicator.** Radix does not tell a trigger whether it is
  selected, so `Tabs` now mirrors the active value into context. The active
  background moved off a `data-active:` class and onto one shared element with
  a `layoutId` — that shared identity is the whole trick: Framer sees the same
  element in a new position and travels it there, instead of cross-fading two
  separate boxes. Same tokens in both themes, so nothing changed colour.
- **List reordering** is opt-in via `layout` on `StaggerItem`, enabled only for
  the repo grid where sorting and filtering genuinely reorder things. Framer
  measures every laid-out child on each change, so switching it on everywhere
  would cost real work for lists that never move. The layout spring is softer
  than the interaction one: many elements moving at interaction speed reads as
  a jolt.
- **Theme toggle** cross-fades the icon with a small rotate, and `body` eases
  between palettes over 220ms. Colour properties only, so nothing moves.
- **Bookmark** springs its icon in on toggle — deliberately the only
  overshooting thing on the site, because it marks the one action that writes
  stored state. **Copy link** springs the check in and cross-fades the label.
- **Search fields** scale 1% on focus from a left origin. Scale rather than
  width, so the row height never changes and nothing below shifts.
- **Slide-over** keeps the Radix enter/exit but on an ease-out curve, with a
  300ms enter and a quicker 200ms exit.

### Phase 4 — chatbox motion

- Turns animate in and out through `AnimatePresence` with `layout="position"`,
  so existing messages slide up to make room instead of jumping.
- The pending state is now a three-dot indicator rather than skeleton bars.
  **This is the only looping animation on the site**, and the exception is
  deliberate: the loop *is* the signal that work is in progress, where a static
  placeholder is indistinguishable from a stalled request. Under reduced motion
  it degrades to the words "Searching…", because three pulsing dots are exactly
  the repetitive movement that preference exists to avoid.
- Result cards inside an answer stagger 50ms apart, so a six-item list finishes
  well before anyone has read the summary above it.
- Auto-scroll to the newest message is smooth, and switches to an instant jump
  under reduced motion — a long smooth scroll is the worst offender there.

### Phase 5 — feedback and loading

- **Skeleton "shimmer" is an opacity breath, not a gradient sweep.** The brief
  asked for a shimmer; the design rules forbid gradients, and the conventional
  shimmer *is* a moving linear-gradient. Resolved with a 2s opacity cycle
  between 1 and 0.65 — same "waiting, not broken" signal with no gradient. It
  is also gentler than Tailwind's `animate-pulse`, which swings to 50% and
  strobes when a page is full of placeholders.
- **Count-up** on the homepage total, the footer total, and the category
  counts. Two deliberate choices stop it shifting layout: the final value is
  what renders on the server, so the element is full-width before the count
  starts and hydration cannot mismatch; and every call site is mono or
  `tabular-nums`, where digits are fixed width. Counting repo *stars* on cards
  was left out — 24 simultaneous counters on a grid is noise, not polish.
- **Scroll progress** on repo detail pages: `scaleX` on a 2px bar, so it never
  triggers layout. Hidden entirely under reduced motion, since a bar tracking
  the scroll is continuous movement with no meaningful static form.

**Toasts were deliberately not added.** Nothing in the app raises one. The only
transient confirmation is the copy-link button, which already answers inline
next to the thing you clicked — strictly better feedback than a message in a
corner. Building a toast system with no event to trigger it would be dead code,
and converting the copy confirmation into a toast would be changing
functionality, which this pass is explicitly not allowed to do.

### Phase 6 — verification, and what it caught

Verified with Playwright at 390px and 1440px, with motion on and reduced,
across seven routes. Kept as `npm run verify:motion` (point `BASE` at a
**production** server — the dev overlay pollutes every measurement).

The sweep found four problems. Three were mine.

**1. Reduced motion left content invisible.** 23-25 on-screen elements stuck at
`opacity: 0, y: 12`, including the entire hero. Cause: each component read
`useReducedMotion()` and swapped its variants object when it resolved. The hook
is `null` during SSR, so elements mounted with the full variants, then had them
replaced — the target variant *name* never changed so Framer had no reason to
re-animate, and the replacement had no `y` key to unwind the transform. The
comment I wrote claimed this approach prevented exactly that failure; it caused
it. Replaced with one global `MotionConfig reducedMotion="user"`, and every
per-component branch deleted.

**2. The entrance animation cost 2.8 seconds of LCP.** `PageTransition` wrapped
the page in `opacity: 0`; Lighthouse does not count an invisible element as
painted, so largest-contentful-paint went 1.1s → 3.9s and performance dropped
76 → 67. The first load now renders at its final state (`initial={false}` until
hydrated) and only real navigations animate. Back to LCP 1.1-1.3s, performance
74-75 against a 76 baseline — parity within run-to-run noise.

**3. `ScrollProgress` returned `null` under reduced motion**, which is a
conditional render driven by a hook that differs between server and client:
React #418 on every detail page. Now always rendered, hidden with
`motion-reduce:hidden`.

**4. CLS 0.14 on the grid pages — this one was *not* mine.** Measured the
pre-motion commit to check, and `/c/ai-ml` showed the identical 0.1444 from the
identical source: the footer jumping when the Suspense boundary resolved,
because the loading fallback was a quarter the height of the real results.
Fixed anyway by reserving height in the fallback. **Now 0 on every route.**

Two of the "failures" were bugs in the test, not the app, and worth recording
because both would have been easy to "fix" in the wrong place:

- `addInitScript` was called per measurement on a reused page, so each
  navigation added another PerformanceObserver to the same counter. The third
  page reported 3x its real CLS. Fresh page per measurement.
- The invisible-content check counted elements up to 200px *past* the fold,
  where the reveal trigger deliberately has not fired yet, and snapshotted
  900ms after scrolling when a 24-card stagger takes ~1.3s. Both were reporting
  correct behaviour as a defect.

Final: all checks pass at both widths in both motion modes, CLS 0 everywhere,
no console errors, no overflow.

## Follow-up: card hover swell

Requested: hovering a repo should make it bulge out slightly. The card already
rose 2px on hover; this adds `scale(1.015)` on top, so it lifts *and* swells.

Scale is a transform, so it costs no layout and cannot nudge a neighbour. Two
things were less obvious:

- **Stacking.** The card grows ~3.7px into the 12px grid gap on each side. The
  grid item is a `motion.li`, and a motion element can carry a transform, which
  makes it a stacking context and traps the card's `z-index` inside it — the
  next card in DOM order would paint over the swell. So `relative hover:z-10`
  is set on the list item as well as on the card.
- **Reduced motion.** The global guard in `globals.css` collapses transition
  *duration*, not the hover state itself, so without an explicit opt-out the
  card would snap to its hovered size instantly rather than not move at all.
  `motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0` pins it.

Measured at 1440px, card 0 on `/explore`:

| | rest | hovered |
| --- | --- | --- |
| size | 490 x 222 | 497.35 x 225.33 (101.5%) |
| rise | — | 3.66px |
| clearance to neighbour | 12px gap | 8.33px still clear |
| neighbour displacement | — | 0px |

Under `prefers-reduced-motion: reduce` the hovered box is 490 x 222 — identical
to rest. Checked hover-time horizontal overflow at 390/768/1440px as well,
since the sweep only measures overflow at rest: `scrollWidth` is unchanged at
every width, and at 390px the hovered card spans 13.3 to 376.7 inside a 390
viewport. `verify:motion` still reports ALL CHECKS PASSED with CLS 0.

## Follow-up: category row hover

Same request applied to the homepage category list. The cards' approach did not
transfer, and the first attempt is worth recording because it measured fine and
still looked wrong.

Scaling the row itself by 1%, exactly as the cards do, gives this at 1440px:

| | value |
| --- | --- |
| row | 992 x 67 |
| growth | +9.92px wide, +0.67px tall |

Fifteen to one. A row is wide and short, so a uniform scale throws its left and
right edges far further than its top and bottom — it reads as a horizontal
stretch, not a swell. Worse, scaling from the centre slid the label ~5px left,
which is the part that actually looked bad on screen.

So the swell is carried by a tinted band behind the row instead of by the row.
A plain rectangle has no text to distort, so it can scale unevenly — ~1% across
against ~10% down — and the growth comes out roughly even in pixels:

| | L/R growth | T/B growth | label drift |
| --- | --- | --- | --- |
| 1440px | 4.96px | 3.35px | 0px |
| 390px | 1.79px | 4.35px | 0px |

The band is `absolute inset-0` under `isolate`, so it paints behind the content
without a negative z-index escaping the row. It inflates past the `divide-y`
rules above and below, which is what sells the row coming forward. The label
does not move at all.

Under reduced motion the band still tints — hover must keep its affordance —
but sits exactly at the row's bounds, 0px growth on every side. Neighbouring
rows move 0px, there is no horizontal overflow at 390 or 1440, and
`verify:motion` still reports ALL CHECKS PASSED with CLS 0.

## Stage 3-6 re-audit (spec re-sent)

The Stages 3-6 spec was re-sent after Stage 2. All of it was already built and
committed, so this pass was an audit against the spec text rather than a
rebuild. Everything it names exists: `npm run discover`, `category-map.json`,
`.github/workflows/discover.yml`, `/explore`, `/ask`, `/gems`, `/r/[...slug]`,
`/saved`, `/compare`, `/stacks/[slug]`, `/submit`, sitemap, robots, OG image,
404. Catalogue: 49 curated + 4,857 discovered = 4,906, with 236 gems.

The audit found five real defects, all in the Stage 6 "accessibility pass,
sitemap, robots" item, and all shipped:

1. **Every absolute URL on the site was relative.** `NEXT_PUBLIC_SITE_URL` is
   declared but empty in `.env`, and `??` only falls back on null/undefined, so
   `SITE.url` was `""`. robots.txt emitted `Sitemap: /sitemap.xml` and every
   detail page emitted `<link rel="canonical" href="/r/owner/name">`. Both are
   invalid; both failed Lighthouse SEO on every page. Blank now counts as unset.
2. **The header search button had no accessible name below 640px.** Its label
   is `hidden sm:inline`, so on mobile it was an icon-only button. `aria-label`
   added. This was failing on every page of the site.
3. **`ScoreBreakdown`'s `<dl>` was invalid.** A `div` inside a `dl` may contain
   only `dt`/`dd`; this one wrapped the pair in a flex div and put the bar and
   explanation beside it, making dt/dd grandchildren. Rebuilt as a two-column
   grid with the bar and explanation in a second `dd`. Layout is pixel-identical
   and the structure now validates.
4. **`aria-pressed` on links.** The filter chips are `<a>`, and `aria-pressed`
   is only allowed on a button role. Changed to `aria-current`.
5. **Contrast and target size.** `text-muted-foreground/70` measured 2.71:1 at
   12px, under the 4.5 AA floor — those three spans now inherit the undimmed
   token. The explore category links were 16px tall; they get `min-h-6` for the
   WCAG 2.2 24px minimum, with no change to text size.

Result, desktop preset, five routes: **performance 99-100, accessibility 100,
best practices 100, SEO 100.** Up from a11y 84-94 and SEO 83-91.

### The one spec item not met: Lighthouse 90+ on the mobile preset

Mobile scores 72-78. Worth being precise about why, because the obvious
explanation is wrong.

LCP is 1.1-1.2s (score 100) and CLS is 0 (score 100). The entire deficit is
total blocking time, 790-980ms, which is main-thread script evaluation during
hydration under the mobile preset's 4x CPU throttle.

I assumed Framer Motion hydrating 24 `motion.li` wrappers per grid page was the
cause, so I tested it: stripped motion from `RepoCardGrid`, rebuilt, remeasured.
TBT got *worse* (840ms -> 1,640ms) and performance moved 72 -> 73. Motion is not
the bottleneck. Reverted.

Repeated runs on one unchanged build gave perf 75/82/78 and TBT 750/1,310/980 —
a ±35% swing, so single numbers here are close to meaningless. Stopping the dev
server to free CPU changed nothing (72/73/78).

The cost is baseline framework hydration: three chunks of 224/160/148KB
uncompressed (React, Next, Radix, Framer). The search index is *not* part of it
— `public/search-index.json` is 2.2MB but lazily fetched by `/ask` and `/saved`
only, never bundled. Reaching 90 on the mobile preset would mean materially
less client JS, i.e. dropping Framer Motion or Radix, which would undo the
motion work and the shadcn component layer. Not a call to make unprompted.

## Rebuilding the assistant so it understands intent

The reported bug: "I want to improve my ui ux of my website" returned repos
containing the word "website".

That was not a weighting problem. The old engine ran Fuse.js in the browser
over the search index, so the only thing it could do was match words, and that
sentence contains exactly one noun a word matcher can grab. "Website" is the
least informative word in it — every repo that serves a web page mentions it —
while the words that carry the actual request, "ui" and "ux", name a category
of tool rather than appearing in any particular repo's text.

So the fix is not better matching. It is searching for something else: the
**kinds of tool the goal implies**, one search per kind.

### What was built

`lib/assistant/needs.ts` — a taxonomy of 57 needs, each with a natural-language
query (embedded), BM25 keywords, and the categories it lives in. Plus 10 goal
patterns that decompose an outcome into needs, and ~95 commercial products
mapped to the need they represent so "alternative to Notion" resolves to the
notes-and-wiki shelf. No repo is ever named from that table.

`lib/assistant/plan.ts` — resolves a message to needs: named products first
(most specific), then goal patterns, then stemmed keyword scoring (least).
Holds the stopword list, which is the direct fix — website, site, app, product,
startup, platform and project describe what the founder already owns and never
reach the search layer.

`scripts/build-embeddings.ts` — MiniLM (all-MiniLM-L6-v2) over every repo and
every need query, at build time, local and free. int8-quantised and base64'd:
2.53MB instead of ~13MB of JSON floats, which matters because the route reads
it on cold start. 4,906 repos in 223s.

`lib/assistant/retrieve.ts` — per need, cosine against the need's prebuilt
embedding blended 62/38 with BM25. Both are needed: embeddings reach "improve
my ui ux" -> component libraries, BM25 reaches `oauth2` -> the repo tagged
oauth2, and each is bad at the other's job.

`lib/assistant/llm.ts` — Gemini, Groq and OpenRouter behind one `completeJson`.
Server-only, and it throws on import if `window` exists.

`lib/assistant/pipeline.ts` — understand, retrieve, rerank, **verify**. The
verify step looks every returned id up in the catalogue and drops it if absent,
or if it was attached to a need it was not retrieved for. The reranker is the
only place a model's output can name a repo, so that is where the guarantee has
to be enforced.

`app/api/ask/route.ts` — NDJSON stream (status, plan, answer), 10-minute cache
keyed on the normalised query, 20 requests/minute/IP.

### Decisions worth recording

**The no-key path is a real path, not a stub.** Both planners emit the same
`Plan`, so nothing downstream can tell which ran. Without a key the assistant
scores 58/60; the key buys free-form understanding of questions the taxonomy
has no pattern for, and better-written reasons. It does not buy correctness.

**Runtime embedding was deliberately avoided.** Needs come from a fixed
taxonomy, so their vectors are precomputed and the request path needs no model
at all — `@huggingface/transformers` stays a devDependency and never enters the
serverless bundle. The cost is that an LLM-invented need outside the taxonomy
gets BM25 and its category bonus but no vector of its own.

**`outputFileTracingIncludes` was required.** The route reads
`data/embeddings.json` via `process.cwd()`, and Next traces imports, not
runtime paths — without the entry the file is missing in production and
retrieval silently degrades to BM25.

**Neither `runtime` nor `dynamic` can be exported from the route.**
`cacheComponents` rejects both; the dev server refuses to compile. Node is the
default runtime anyway and a POST handler is never prerendered.

**The old engine was deleted**, not left in place: `lib/assistant/index.ts`,
`roles.ts` and `synonyms.ts`, 820 lines. Nothing imported them once the panel
moved to the API, and leaving a second word-matching engine in the tree invites
confusion about which one actually answers.

**Three pieces of copy were factually wrong afterwards** and were corrected:
/ask said "keyword retrieval, not a language model", the slide-over said "No
model, no account, nothing sent anywhere", and the panel's welcome text made
the same claim. The replacement wording holds in both configurations.

### Test results

`npm run test:assistant` — 60 queries, passing when at least 2 of the top 3
results land in the expected categories.

| Stage | Pass rate |
| --- | --- |
| Baseline, taxonomy + embeddings + BM25 | 46/60 (76.7%) |
| After stemming | 52/60 (86.7%) |
| After fixing over-generic keywords and weighting the interleave | 55/60 (91.7%) |
| After closing vocabulary gaps | 57/60 (95.0%) |
| After stripping constraint phrases before need scoring | **58/60 (96.7%)** |

Target was 54/60.

Four of those gains were bugs rather than tuning, and are worth naming:

- **Morphology.** Most of the first 14 failures were one word in two forms:
  "vulnerabilities" vs `vulnerability`, "scrape" vs `scraping`, "crashes" vs
  `crash-reporting`, "tests" vs `testing`. A small suffix stemmer, not a full
  Porter — Porter conflates "universal" and "university", which in a catalogue
  of developer tools produces baffling results.
- **Keyword matching bypassed the stopword list.** The raw-message check ran
  before it, so "build" — a stopword, and also a ci-cd keyword — made "build a
  chatbot over my docs" resolve to continuous integration.
- **Over-stemming collided.** "production" stems to "product", which met
  e-commerce's `products` keyword, so "my app crashes in production" returned
  storefronts. The keyword was too generic to keep either way.
- **Strict round-robin buried the best answer.** With three needs, the top
  three showed one result from each, so the primary need appeared once beside
  two speculative ones. The first need now takes two slots on the first pass.

### The two remaining failures are data, not retrieval

"feature flags so I can roll out slowly" returns bucketeer and featbit;
"realtime collaborative editing" returns partykit and hocuspocus. Those are
the right tools. They fail the assertion because the discovery import filed
them under marketing-seo, productivity-automation and infrastructure-devops
respectively — the known mechanical misclassification tail. I did not edit the
expectations to pass, and did not recategorise repos to pass; either would be
measuring the fix rather than the system.

## Connecting a real LLM key

The key worked first time. The model name did not, and the way it failed is
the part worth recording.

`engine` came back `llm:gemini+fallback` while the answer looked completely
fine — because the fallback is good. Every LLM call was 404ing and the only
evidence was four characters in a field nobody reads. **The silent catch was
the real bug**, so both catches now log the provider's own message
server-side. Everything below was found in the minute after adding that line.

### What the probes found

`gemini-2.0-flash`, the default I had written, is retired: *"This model is no
longer available."* Model names age out, and my knowledge cutoff predates the
current ones, so I asked the API for its model list rather than guessing
again — and then probed each candidate, because the list over-reports
(`gemini-2.5-flash` is listed and still 404s with "no longer available to new
users").

Against a free-tier key, November 2026:

| Model | Result |
| --- | --- |
| `gemini-flash-lite-latest` | 1.2-3.1s, answered every call |
| `gemini-3.5-flash` | 4.3-5.1s when it worked, 503 about half the time |
| `gemini-3-flash-preview` | 2.4s once, then 503 |
| `gemini-flash-latest` | 503 every time, "high demand" |
| `gemini-3.8-flash` | 429, not on the free tier |
| `gemini-3.1-flash-lite` | worked, but 43s |
| `gemini-2.5-flash` | 404, "no longer available to new users" |

**The `-latest` aliases are not the safe choice they look like.**
`gemini-flash-latest` points at whatever is newest, which is also whatever
everyone is hammering. `gemini-flash-lite-latest` is an alias to a tier nobody
is stampeding, and it was the only name that answered every single time.

### Three fixes, in the order the evidence arrived

1. **Default model → `gemini-flash-lite-latest`.** Chosen on reliability, not
   speed. Neither task here is hard reasoning — decompose a goal into needs,
   then pick 3 of 40 supplied candidates and write a sentence from supplied
   fields — and side by side on three real questions the decompositions were
   comparable. The fallback chain now climbs *up* to the heavier models rather
   than down, which is backwards from the usual arrangement and is what the
   measurements supported.
2. **Fall through to another model rather than retrying the same one.** A
   retry after a 503 that says "experiencing high demand" just queues behind
   the same congestion.
3. **Timeout 12s → 20s → 12s.** It was raised because the real prompts are far
   bigger than the probe that chose the model, then lowered again once lite
   became the default: at 1-3s typical, the timeout's job is no longer to wait
   out a slow answer but to abandon a congested model quickly.

Two things the live output exposed that the keyless path never would have:

- **Need labels came back as sentences.** "UI component library and design
  system for modern interfaces" is unusable as a section heading. The prompt
  now demands 1-3 words and gives examples.
- **The model invented a "Payment gateway" need** for "build an AI SaaS". This
  catalogue has no payments or billing category by design, so that section
  could only ever come back empty. The prompt now says so explicitly.

Also trimmed the rerank payload — 40 candidates at 180-char descriptions and
eight topics each was 8.5KB — though the measurements later showed congestion,
not size, was what caused the timeouts. The trim stays because it is free.

### Result

`llm:gemini`, 7.2s end to end, both calls live. Visibly better answers:
shadcn-ui/ui, headlessui and chakra-ui/ark for components against the
keyless path's chakra-ui/ark, reka-ui and headlessui — and real written
reasons instead of templated field lists. The keyless path is untouched and
still scores 58/60.
