# Security audit

Date: 2026-11-07 · Audited at commit `d95b823`, fixes applied on top.

---

## 1. Executive summary

**Read this first: this application is not a SaaS.** It has no user accounts, no
sessions, no database, no payments, no file uploads, no webhooks, no admin area
and no storage buckets. It is a statically prerendered catalogue of public
open-source repositories with exactly one server endpoint. That single fact
determines most of what follows — **9 of the 19 protocols are NOT APPLICABLE**,
and saying so honestly is more useful than inventing an authorisation layer for
data that has no owner.

What the audit did find was real, and all of it is now fixed:

| Severity | Finding | Status |
| --- | --- | --- |
| **HIGH** | Stored XSS via JSON-LD — `JSON.stringify` into `dangerouslySetInnerHTML`, fed by GitHub-authored descriptions that are imported weekly and automatically | FIXED |
| **MEDIUM** | `javascript:`/`data:` URLs accepted by the schema and rendered as `href` — `z.url()` is a syntax check, not a safety check | FIXED |
| **MEDIUM** | No security headers at all — no CSP, HSTS, nosniff, Referrer-Policy, frame protection or Permissions-Policy | FIXED |
| **MEDIUM** | `/api/ask` accepted any content type and any body size, enabling no-preflight cross-site POSTs that burn paid LLM quota | FIXED |
| **MEDIUM** | Internal error text streamed to the browser — provider errors and filesystem paths | FIXED |
| **LOW** | `shadcn` CLI in production `dependencies`, carrying 3 advisories into the production tree | FIXED |
| **LOW** | `/compare?ids=` did unbounded work per token | FIXED |
| **LOW** | Untrusted repo text reaches the LLM prompt (prompt injection) | PARTIALLY FIXED |

**45 security tests now run as `npm run test:security`**, all passing. Every
finding above has a test that fails if it regresses.

The most important thing I can tell you: the two XSS findings were not
theoretical. 14 catalogue descriptions already contain `<` or `>`, one of them
literally `</>`, and `data/discovered.json` is refilled by a GitHub Action every
week with no human in the loop. Anyone could have created a repo whose
description contained a closing script tag and waited.

---

## 2. Technology stack identified

| Layer | What it actually is |
| --- | --- |
| Framework | Next.js 16.4.5, App Router, `cacheComponents` (PPR) + `partialPrefetching` |
| Rendering | Almost entirely prerendered at build time; 300 repo pages prerendered, rest on first request |
| Language | TypeScript, strict |
| Styling | Tailwind v4 via a Turbopack loader; shadcn/ui (`radix-nova`), Radix primitives |
| Data store | **None.** Committed JSON: `data/repos.json` (49), `data/discovered.json` (4,857) |
| Auth | **None.** No accounts, no sessions, no cookies. Theme and bookmarks are `localStorage`, per browser |
| Server endpoints | **One:** `POST /api/ask` |
| Server actions | None |
| Outbound calls | Gemini/Groq/OpenRouter from the API route; GitHub API from build scripts only |
| Secrets | `LLM_API_KEY`, `LLM_PROVIDER`, `GITHUB_TOKEN` — all server-side, verified absent from the client bundle |
| Deployment | Static-friendly; Vercel assumed |
| CI | One GitHub Action (weekly discovery import, opens a PR) |

---

## 3. The 19 protocols

### 1. Row-Level Security — NOT APPLICABLE

There is no database. All data is public, committed JSON describing public
GitHub repositories. There are no rows, no owners, and no per-user records to
isolate. Implementing RLS would require first inventing a database and a user
model that the product does not have.

*If accounts are ever added*, the natural place for this is whatever database
backs them; today there is nothing to protect.

### 2. Authentication on every API route — NOT APPLICABLE (by design), audited

Every endpoint was enumerated. There is exactly one: `POST /api/ask`. It is
**intentionally public** — it is the search assistant on a site with no login,
and requiring authentication would break the product's stated premise ("free,
no login, no paywall"). It reads a public catalogue and returns public data.

It is not unprotected, though: content-type enforcement, body-size limits,
input validation, per-IP rate limiting and output verification all apply. See
protocols 4, 5 and 10.

No other route handlers, server actions, or mutating endpoints exist.

### 3. Never trust the frontend — FIXED

There is no user identity, role, price or subscription for a client to forge.
What the client *can* send is the `/api/ask` body, and that is now fully
re-derived and constrained server-side:

- `message` must be a string; trimmed; capped at 500 characters.
- `history` must be an array; non-strings dropped; capped at 6 entries.
- The body must be a JSON **object** — arrays and primitives are rejected.
- Total body capped at 8KB, checked against both `Content-Length` and actual bytes.
- The repo list returned is **never** taken from the client, and never from the
  LLM: every id the model returns is looked up in the catalogue and dropped if
  absent, or if attached to a need it was not retrieved for.

### 4. Rate limiting — PARTIALLY FIXED

Implemented per-IP in `app/api/ask/route.ts`: 20 requests per 60s sliding
window, returning **429** with a plain message. Verified: requests 1–19
returned 200, request 20 onward returned 429.

**Why partial, honestly:** the counter is an in-memory `Map`, so it is
per-instance. On a horizontally scaled or serverless deploy, an attacker gets
20 requests *per warm instance*. It also trusts the first `X-Forwarded-For`
entry, which is only trustworthy if the platform overwrites that header
(Vercel does; a naive self-hosted proxy may not).

For a keyless deployment this is adequate — the endpoint is read-only over
public data. **If you set `LLM_API_KEY`, each request costs money**, and a
shared store (Upstash Redis, Vercel KV) becomes worth the dependency. See
§10.

### 5. Sanitise user input — FIXED

- API input: typed, trimmed, length-capped, shape-checked (see protocol 3).
- Output encoding: React escapes all interpolated text. Verified by reflecting
  `<script>alert(1)</script>` through `/explore?q=` — **0 raw occurrences** in
  the response.
- The one place that bypassed React's escaping was the JSON-LD block, which is
  now escaped explicitly (protocol 18 / §4 below).
- Catalogue text is third-party content and is treated as such.

### 6. Parameterised database queries — NOT APPLICABLE

No database, no SQL, no ORM, no query strings of any kind. Data access is
array lookups over imported JSON. There is no injection surface because there
is no query language.

### 7. Lock down CORS — FIXED (by having none)

`/api/ask` sets **no** `Access-Control-Allow-Origin` header, so the browser
same-origin policy blocks cross-origin reads by default — which is the
strictest correct configuration. There is no wildcard anywhere, and no
credentialed cross-origin request to misconfigure.

The gap was that a cross-origin page could still *send* a no-preflight POST
(costing quota without reading the reply). Requiring `application/json` closes
that, because that content type is not form-encodable and therefore forces a
preflight this origin never answers. Verified: `text/plain` and
`application/x-www-form-urlencoded` both return **415**.

### 8. HTTPS everywhere — PARTIALLY FIXED / NEEDS MANUAL CONFIGURATION

Implemented in code:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains`, **production only**.
- `upgrade-insecure-requests` in the production CSP.
- All outbound calls (LLM providers, GitHub API) are hardcoded `https://`.

HSTS is deliberately **not** sent in development: pinning `localhost` to HTTPS
in a developer's browser for two years breaks every other local project and is
painful to undo. `preload` is deliberately omitted — submitting to the preload
list is a one-way door that should be a conscious decision against a real
domain, not a default buried in a config file.

**You must still:** terminate TLS and redirect HTTP→HTTPS at the platform
(Vercel does both automatically). No cookies are set, so there is no `Secure`
cookie flag to configure.

### 9. IDOR — NOT APPLICABLE, audited

Every identifier in the app (`/r/[owner]/[name]`, `/c/[slug]`, `?ids=`)
addresses a **public** repository record. There is no per-user data, so there
is no "another user's record" to reach. Changing any id in any URL yields
another public catalogue page, which is the intended behaviour of a directory.

Audited anyway: `repoHref()` already applies `encodeURIComponent` to both
segments, so no path traversal or protocol-relative URL can be constructed
from catalogue data.

### 10. Disable debug mode in production — FIXED

- Production builds carry no dev overlay or stack traces.
- **Fixed:** `/api/ask` streamed `error.message` straight to the browser. Those
  messages include provider responses (`gemini 404: models/... is no longer
  available`) and could include filesystem paths from an `ENOENT`. The client
  now receives a fixed string; the detail goes to `console.error` server-side.
- Verified: `/.env`, `/.env.local`, `/data/*.json`, `/package.json`,
  `/next.config.ts` and `/.git/config` all return **404**.

### 11. CAPTCHA on public forms — NOT APPLICABLE / NEEDS MANUAL CONFIGURATION

There are no forms that write anything. The "Submit a repo" page does not post
to this application — it builds a prefilled GitHub issue URL, so abuse lands on
GitHub's own spam controls, not here.

The only abusable endpoint is `/api/ask`, which is rate-limited. **If you
enable an LLM key and see automated abuse**, a CAPTCHA (Turnstile is free and
privacy-respecting) on that endpoint is the right next step. It needs an
external account and keys, so it is not something this audit could complete.

### 12. Log administrative actions — NOT APPLICABLE

There are no administrative operations, no roles, no accounts to suspend, no
permissions to change. The only mutating operation in the whole system is the
weekly discovery Action, which opens a **pull request** — so every change to
the catalogue is already an auditable, reviewable, attributable git commit.

### 13. Private storage buckets — NOT APPLICABLE

No object storage, no uploads, no user files. `public/` contains only generated
public assets (`search-index.json`, the OG image). Verified that `data/` — which
holds the embeddings and the raw catalogue — is **not** web-served (404).

### 14. Hide and protect admin pages — NOT APPLICABLE

There is no admin area, no privileged route, and no role system. Every route is
public and intended to be.

### 15. Update vulnerable packages — FIXED

Before: 3 low-severity advisories (`deepmerge` prototype pollution, reached
through the `shadcn` CLI), present in the **production** dependency tree.

`npm audit fix --force` is explicitly forbidden by this project's implementation guide — it
downgrades `shadcn` 4.x → 1.0.0, a breaking change — and there is no upstream
fix (the advisory covers `>=4.2.0`; `4.3.1` is the latest release).

**The actual fix was different and better:** `shadcn` is a command-line tool,
not a runtime dependency. It was in `dependencies`. Moving it to
`devDependencies` removes it from the production tree entirely.

| | Before | After |
| --- | --- | --- |
| `npm audit --omit=dev` | 3 low | **0 vulnerabilities** |
| `npm audit` (incl. dev) | 3 low | 3 low (build tooling only, never shipped) |

The build still works, because `globals.css` imports `shadcn/tailwind.css` at
**build** time, and devDependencies are installed during a build. Verified.

### 16. Validate file upload types — NOT APPLICABLE

The application accepts no file uploads. There is no upload endpoint, no
multipart parsing, and no write path to disk at request time.

### 17. Independent second-pass review — DONE

Conducted after the fixes; see §9 for what it found and what remains. Three
additional issues were found in the second pass that the first pass missed:
the `/compare` unbounded input, the prompt-injection surface, and the fact
that `shadcn` sat in production dependencies rather than dev.

### 18. Security headers — FIXED

Added in `next.config.ts`, applied to every route. Verified live on `/gems`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;
  connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
  frame-ancestors 'none'; frame-src 'none'; worker-src 'self' blob:;
  manifest-src 'self'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(),
  magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
```

**An honest caveat about `'unsafe-inline'` on `script-src`.** It is there
because Next's App Router streams RSC payloads and bootstrap code through
inline `<script>` tags on every page. Removing it requires a per-request nonce,
which requires middleware that reads the request — and under `cacheComponents`
that would make every route dynamic and discard the prerendering this entire
site is built on. The trade was made deliberately: keep the prerendering, state
the limitation, and close the injection paths instead, which is exactly what the
JSON-LD escaping and href allowlist do. `object-src 'none'`, `base-uri 'self'`
and `frame-ancestors 'none'` remain fully effective regardless.

**Verified not to break anything:** all 10 routes load with 0 CSP violations and
0 console errors, the chat round-trips, and the theme toggle works.

### 19. Verify webhook signatures — NOT APPLICABLE

The application exposes no webhook endpoints. The only inbound HTTP is
`POST /api/ask`. The weekly GitHub Action is *outbound* CI, authenticated with
the token GitHub issues it automatically; it does not call back into the app.

---

## 4. Vulnerabilities discovered (detail)

### HIGH — Stored XSS via JSON-LD structured data

`app/(site)/r/[...slug]/page.tsx` rendered:

```tsx
<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(repo)) }} />
```

`JSON.stringify` escapes quotes and backslashes. It does **not** escape `<`.
A repo description containing `</script>` therefore closes the element early
and everything after it is parsed as HTML.

Reproduced before fixing:

```
{"name":"evil/repo","description":"Totally normal tool.</script><img src=x onerror=alert(document.domain)><script>"}
contains a literal closing script tag: true
```

**Exploitability is the point here.** The attacker does not need access to this
repository. They create a public GitHub repo with a hostile description, get it
past the discovery import's quality filters, and wait for the weekly Action —
which commits to `data/discovered.json` via an automated PR. 14 descriptions in
the catalogue *already* contain `<` or `>`.

### MEDIUM — `javascript:` and `data:` URLs rendered as links

`repo.homepage` and `repo.docsUrl` are set by repo owners, imported
automatically, and rendered as `<a href={...}>`. The schema used `z.url()`,
which is a **syntax** check. Measured:

```
ACCEPTED  javascript:alert(1)
ACCEPTED  data:text/html,<script>alert(1)</script>
ACCEPTED  https://ok.example
```

All 3,902 homepages in the catalogue are currently http/https — which is a fact
about today, not a control.

### MEDIUM — No security headers

Confirmed absent before the fix: no CSP, HSTS, `X-Content-Type-Options`,
`Referrer-Policy`, frame protection, or `Permissions-Policy`. The site was
framable, sniffable, and had no defence-in-depth against injected content.

### MEDIUM — `/api/ask` accepted anything

No content-type check (so a cross-origin form could POST without a preflight and
spend LLM quota), no body-size limit before `request.json()` buffered the whole
payload, and non-object JSON reached the handler.

### MEDIUM — Internal error text returned to the client

The NDJSON error frame carried `error.message` verbatim.

### LOW — `shadcn` CLI in production dependencies

See protocol 15.

### LOW — `/compare?ids=` unbounded work

Every comma-separated token was resolved and every unmatched one rendered. 500
ids produced an 83KB response. Node's own URL-length limit answers **431** past
~1,500 ids, which bounded it in practice — but that is incidental runtime
protection, not a decision the page made.

### LOW / PARTIALLY FIXED — Prompt injection via catalogue text

Repo names, topics and descriptions are third-party text and are placed in the
LLM rerank prompt. A hostile description can attempt to steer the model.

**Mitigations in place:** the model is told explicitly that candidates are data
and not instructions; descriptions are truncated to 110 characters; and —
decisively — **every repo id the model returns is verified against the
catalogue**, so the model cannot introduce a repository, only reorder and
describe ones retrieval already found. Reasons render as React text, so no
markup can escape.

**Residual risk:** a determined description could influence the wording of a
"why this matches" line or the summary. It cannot fabricate a repo, inject
markup, or exfiltrate anything. Accepted and documented rather than claimed
solved.

---

## 5. Vulnerabilities fixed

| # | Finding | Severity | Status | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Stored XSS via JSON-LD | HIGH | FIXED | 5 unit tests + live page assertion on `/r/deco-cx/deco` |
| 2 | `javascript:`/`data:` in `href` | MEDIUM | FIXED | 8 scheme tests + 3 schema tests |
| 3 | Missing security headers | MEDIUM | FIXED | 10 header assertions + 10-route CSP regression sweep |
| 4 | API content-type / body size | MEDIUM | FIXED | 6 API validation tests |
| 5 | Error text leakage | MEDIUM | FIXED | Code review + generic-message assertion |
| 6 | Vulnerable package in prod tree | LOW | FIXED | `npm audit --omit=dev` → 0 |
| 7 | `/compare` unbounded input | LOW | FIXED | Measured: 0 tokens rendered beyond the cap |
| 8 | Prompt injection | LOW | PARTIALLY FIXED | Id verification is tested; wording influence is accepted |

---

## 6. Files modified

| File | Change |
| --- | --- |
| `lib/safe-url.ts` | **New.** `isSafeHttpUrl`, `safeHref`, `serializeJsonLd` |
| `lib/schema.ts` | `url`, `homepage`, `docsUrl`, `avatarUrl` now require an http(s) scheme |
| `app/(site)/r/[...slug]/page.tsx` | `serializeJsonLd` for JSON-LD; `safeHref` on homepage and docs links |
| `next.config.ts` | `headers()` — CSP, HSTS, nosniff, Referrer-Policy, frame protection, Permissions-Policy, COOP |
| `app/api/ask/route.ts` | Content-type enforcement, 8KB body cap, object-shape check, generic client errors |
| `app/(site)/compare/page.tsx` | `MAX_TOKENS` cap before resolving |
| `lib/assistant/pipeline.ts` | Prompt hardening: candidates are data, not instructions |
| `package.json` | `shadcn` → devDependencies; added `test:security` |
| `scripts/test-security.ts` | **New.** 45 security regression tests |

---

## 7. Database changes and migrations

**None required — there is no database.** No migrations, no RLS policies, no
schema changes to apply.

The only "schema" is the Zod contract in `lib/schema.ts`, and the tightened URL
rules were validated against all 4,906 existing records: `npm run validate`
passes with no rejections, so no data migration is needed.

---

## 8. Tests performed and results

Run with `npm run test:security` (needs a production server on `BASE`).

```
XSS — JSON-LD escaping ................................ 5/5 pass
XSS — href scheme allowlist ........................... 8/8 pass
Schema — dangerous URLs cannot enter .................. 3/3 pass
Secrets — nothing secret in the browser bundle ........ 3/3 pass
Security headers ..................................... 10/10 pass
API input validation .................................. 6/6 pass
Information disclosure ................................ 7/7 pass
Stored XSS on a real catalogue page ................... 3/3 pass
                                                        45 passed, 0 failed
```

Additional verification performed:

| Test | Result |
| --- | --- |
| Rate limiting | 19 × 200 then **429** from request 20; correct message |
| Cross-origin POST (`text/plain`, form-encoded) | **415** both |
| Oversized body (1MB) | **400** |
| `GET /api/ask` | **405** |
| Reflected XSS via `/explore?q=<script>` | **0** raw occurrences |
| Secrets in the 37 built client files | `LLM_API_KEY`, `GITHUB_TOKEN`, `LLM_PROVIDER` all absent |
| CSP regression — 10 routes | 0 violations, 0 console errors, all render |
| Chat round-trip under CSP | Works, groups returned |
| `/compare` with 500 ids | 0 tokens rendered beyond cap; residual size is Next echoing the URL |
| Existing functionality — `npm run test:assistant` | **58/60**, unchanged |
| `npm run validate` | 4,906 records valid |
| Lint, typecheck, build | Clean, exit 0 |
| Lighthouse (desktop, `/gems`) | a11y **100**, best-practices **100**, SEO **100** |

### One unresolved measurement issue — honest note

`npm run verify:motion` intermittently reports a CLS spike (0.20–0.24) at
390px on `/gems` or `/r/...`, at ~320–380ms. I could not resolve it and will
not claim it clean:

- The pre-security build measured **8/8 runs at CLS 0**.
- The post-fix build measured **clean in 11 consecutive runs**, then failed again.
- The failing element varies by route and shifts in **both** directions, always
  on a text element.
- It co-occurred with Lighthouse returning `NO_NAVSTART` — a tracing failure
  that indicates machine contention.
- `lib/fonts.ts` uses `next/font/google` with the default `display: swap` and no
  preload link in the HTML, so the fallback font paints first and reflows when
  Geist arrives. Under load that lands after the observer window.

My assessment is that this is **font-swap reflow under machine load, not a
security regression** — no security test depends on it, and none of the changed
code touches layout. But the baseline comparison was taken in a quieter window,
so I cannot fully exclude a contribution from my changes. **Re-run
`npm run verify:motion` on an idle machine or in CI to settle it.** If it
persists, `display: "optional"` on the fonts is the likely fix.

---

## 9. Remaining risks

| Risk | Severity | Why it remains |
| --- | --- | --- |
| `'unsafe-inline'` in `script-src` | MEDIUM | Next App Router requires inline scripts; a nonce needs request-reading middleware, which would disable prerendering site-wide. Injection paths closed individually instead. |
| Rate limiting is per-instance | MEDIUM **if a key is set** | In-memory counter. With `LLM_API_KEY` configured, every request costs money and a distributed attacker gets 20/instance. Needs a shared store. |
| `X-Forwarded-For` trusted | LOW–MEDIUM | Only safe behind a proxy that overwrites it. Vercel does. A naive self-hosted proxy would allow rate-limit evasion by header spoofing. |
| Prompt-injection wording influence | LOW | Model cannot introduce repos or markup; it could be nudged on phrasing. |
| No CAPTCHA on `/api/ask` | LOW | Rate limiting only. Becomes relevant under real automated abuse with a key set. |
| Supply chain: weekly auto-import | LOW–MEDIUM | The Action writes third-party text into the catalogue via PR. Both XSS sinks are now closed, but **review those PRs** rather than auto-merging. |
| 3 low advisories in dev tooling | INFORMATIONAL | `deepmerge` via the shadcn CLI. No upstream fix. Never shipped to users. |
| 220 catalogue homepages are `http:` | INFORMATIONAL | Third-party sites, not ours. Links out only. |
| No automated backups | LOW | All data is in git, which is the backup. No database to snapshot. |

---

## 10. Production deployment recommendations

**Must do before going live**

1. **Set `NEXT_PUBLIC_SITE_URL`** to the real domain. It is currently blank, so
   canonical URLs and `sitemap.xml` fall back to `localhost:3000`. (Found in an
   earlier audit; still outstanding.)
2. **Set `SITE.repo`** in `lib/site.ts` — still the placeholder
   `anuj/oss-for-founders`, which is where "Suggest this repo" sends people.
3. **Confirm HTTPS and HTTP→HTTPS redirect** at the platform. Vercel does this
   automatically; verify if self-hosting.
4. **Set `LLM_API_KEY` as a server environment variable only.** Never prefix it
   with `NEXT_PUBLIC_`. The code guards against this (`lib/assistant/llm.ts`
   throws if imported where `window` exists), but the variable name is yours to
   get right.

**Should do if you enable an LLM key**

5. **Move rate limiting to a shared store** (Vercel KV or Upstash Redis). This
   is the single highest-value remaining hardening, because with a key each
   request has a real cost.
6. **Consider Cloudflare Turnstile** on `/api/ask` if automated abuse appears.
7. **Set a billing cap / budget alert** at the LLM provider. A rate limit
   protects against volume; a spend cap protects against surprises.

**Operational**

8. **Review the weekly discovery PR before merging.** It imports third-party
   text. The injection sinks are closed, but a human glance is cheap.
9. **Run `npm run test:security` in CI** against a built server, so a
   regression in any of the 45 checks fails the build.
10. **Re-run `npm run verify:motion` on an idle machine** to settle the CLS
    question in §8.
11. **HSTS `preload`** is deliberately not set. If you want it, add it only
    once you are certain the domain and all subdomains will be HTTPS forever.

---

## Appendix — how to reproduce the audit

```bash
npm run lint && npm run typecheck && npm run validate
npm run build
npx next start -p 3100 &
BASE=http://localhost:3100 npm run test:security   # 45 checks
npm run test:assistant                             # functionality, 58/60
npm audit --omit=dev                               # production tree: 0
```
