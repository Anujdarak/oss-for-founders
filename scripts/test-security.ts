/**
 * Security regression tests.
 *
 * These exist because every one of them corresponds to a real defect found in
 * this codebase, not to a checklist item. If one fails, something that was
 * broken once is broken again.
 *
 *   npm run build && npx next start -p 3100
 *   BASE=http://localhost:3100 npm run test:security
 *
 * The unit-level checks run without a server; the HTTP ones are skipped with
 * a clear message if nothing is listening, rather than passing silently.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { isSafeHttpUrl, safeHref, serializeJsonLd } from "../lib/safe-url"
import { repoSchema } from "../lib/schema"

const BASE = process.env.BASE ?? "http://localhost:3100"

let passed = 0
let failed = 0
const failures: string[] = []

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1
    console.log(`  pass  ${name}`)
  } else {
    failed += 1
    failures.push(name + (detail ? ` — ${detail}` : ""))
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`)
  }
}

const LT = String.fromCharCode(60)
const BACKSLASH = String.fromCharCode(92)

async function main() {
  console.log("\nXSS — JSON-LD escaping (stored XSS via imported repo descriptions)")
  {
    const hostile = {
      description: `x${LT}/script${LT.replace(LT, ">")}`,
      raw: `tool.${LT}/script>${LT}img src=x onerror=alert(1)>`,
    }
    const out = serializeJsonLd(hostile)
    check("no raw '<' survives serialisation", !out.includes(LT))
    check("closing script tag is neutralised", !/<\/script>/i.test(out))
    check("escape sequence is emitted", out.includes(BACKSLASH + "u003c"))
    check(
      "value still decodes to the original string",
      JSON.parse(out).raw === hostile.raw
    )
    const sep = serializeJsonLd({ v: `a${String.fromCodePoint(0x2028)}b` })
    check("U+2028 is escaped", sep.includes(BACKSLASH + "u2028"))
  }

  console.log("\nXSS — href scheme allowlist (javascript: in an imported homepage)")
  {
    check("javascript: blocked", !isSafeHttpUrl("javascript:alert(1)"))
    check("data: blocked", !isSafeHttpUrl("data:text/html,<script>alert(1)</script>"))
    check("vbscript: blocked", !isSafeHttpUrl("vbscript:msgbox(1)"))
    check("uppercase JavaScript: blocked", !isSafeHttpUrl("JaVaScRiPt:alert(1)"))
    check("leading-whitespace bypass blocked", !isSafeHttpUrl("  javascript:alert(1)"))
    check("https allowed", isSafeHttpUrl("https://example.com"))
    check("http allowed", isSafeHttpUrl("http://example.com"))
    check("safeHref returns undefined for unsafe input", safeHref("javascript:1") === undefined)
  }

  console.log("\nSchema — dangerous URLs cannot enter the catalogue")
  {
    const base = {
      // kebab-case: the schema enforces the id format separately.
      id: "x-y",
      name: "y",
      owner: "x",
      url: "javascript:alert(1)",
      category: "developer-tools",
      description: "d",
      tags: [],
      source: "curated",
      reviewed: false,
      addedAt: "2026-01-01",
      isEditorPick: false,
      isHiddenGem: false,
    }
    check("repo.url rejects javascript:", !repoSchema.safeParse(base).success)
    check(
      "repo.homepage rejects javascript:",
      !repoSchema.safeParse({ ...base, url: "https://github.com/x/y", homepage: "javascript:1" })
        .success
    )
    check(
      "a clean record still validates",
      repoSchema.safeParse({ ...base, url: "https://github.com/x/y" }).success
    )
  }

  console.log("\nSecrets — nothing secret reaches the browser bundle")
  {
    const dir = ".next/static"
    const files: string[] = []
    try {
      const walk = (d: string) => {
        for (const entry of readdirSync(d)) {
          const full = path.join(d, entry)
          if (statSync(full).isDirectory()) walk(full)
          else files.push(full)
        }
      }
      walk(dir)
    } catch {
      console.log("  skip  no .next/static — run `npm run build` first")
    }

    if (files.length > 0) {
      let envText = ""
      try {
        envText = readFileSync(".env", "utf8")
      } catch {
        /* no .env locally; nothing to leak */
      }
      const secrets = envText
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/))
        .filter((m): m is RegExpMatchArray => Boolean(m))
        .filter((m) => m[2].trim() && !m[1].startsWith("NEXT_PUBLIC_"))

      const bundle = files.map((f) => readFileSync(f, "utf8")).join("\n")
      for (const [, name, rawValue] of secrets) {
        check(`${name} absent from the client bundle`, !bundle.includes(rawValue.trim()))
      }
      if (secrets.length === 0) console.log("  skip  no non-public secrets set locally")
    }
  }

  // ---- HTTP checks ----------------------------------------------------
  let serverUp = true
  try {
    await fetch(BASE, { method: "HEAD" })
  } catch {
    serverUp = false
  }

  if (!serverUp) {
    console.log(`\nHTTP checks SKIPPED — nothing listening on ${BASE}`)
    console.log("  start one with: npm run build && npx next start -p 3100")
  } else {
    console.log("\nSecurity headers")
    {
      const res = await fetch(`${BASE}/gems`)
      const h = res.headers
      const csp = h.get("content-security-policy") ?? ""
      check("Content-Security-Policy present", csp.length > 0)
      check("CSP default-src is self", csp.includes("default-src 'self'"))
      check("CSP blocks framing", csp.includes("frame-ancestors 'none'"))
      check("CSP blocks objects", csp.includes("object-src 'none'"))
      check("CSP has no wildcard script source", !/script-src[^;]*\*/.test(csp))
      check("X-Content-Type-Options: nosniff", h.get("x-content-type-options") === "nosniff")
      check("Referrer-Policy set", (h.get("referrer-policy") ?? "").length > 0)
      check("Permissions-Policy set", (h.get("permissions-policy") ?? "").length > 0)
      check("X-Frame-Options: DENY", h.get("x-frame-options") === "DENY")
      check(
        "HSTS present in a production build",
        (h.get("strict-transport-security") ?? "").includes("max-age=")
      )
    }

    console.log("\nAPI input validation — /api/ask")
    {
      const post = (init: RequestInit) => fetch(`${BASE}/api/ask`, { method: "POST", ...init })

      check(
        "form-encoded body rejected (415)",
        (await post({
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "message=hi",
        })).status === 415
      )
      check(
        "text/plain carrying JSON rejected (415)",
        (await post({
          headers: { "content-type": "text/plain" },
          body: JSON.stringify({ message: "hi" }),
        })).status === 415
      )
      check(
        "oversized body rejected (400)",
        (await post({
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: "a".repeat(200_000) }),
        })).status === 400
      )
      check(
        "non-object JSON rejected (400)",
        (await post({
          headers: { "content-type": "application/json" },
          body: "[1,2,3]",
        })).status === 400
      )
      check(
        "empty message rejected (400)",
        (await post({
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: "   " }),
        })).status === 400
      )
      check("GET not allowed (405)", (await fetch(`${BASE}/api/ask`)).status === 405)
    }

    console.log("\nInformation disclosure — nothing sensitive is served")
    {
      for (const route of [
        "/.env",
        "/.env.local",
        "/data/embeddings.json",
        "/data/repos.json",
        "/package.json",
        "/next.config.ts",
        "/.git/config",
      ]) {
        check(`${route} is not served`, (await fetch(`${BASE}${route}`)).status === 404)
      }
    }

    console.log("\nStored XSS — a real catalogue page with angle brackets in its description")
    {
      const res = await fetch(`${BASE}/r/deco-cx/deco`)
      if (res.status !== 200) {
        console.log("  skip  /r/deco-cx/deco not present in this build")
      } else {
        const html = await res.text()
        const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
        check("JSON-LD block is present", Boolean(match))
        if (match) {
          const body = match[1]
          check("no raw '<' inside the JSON-LD block", !body.includes(LT))
          check("JSON-LD still parses", (() => {
            try {
              JSON.parse(body)
              return true
            } catch {
              return false
            }
          })())
        }
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log("\nFailures:")
    for (const f of failures) console.log("  - " + f)
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error("security tests crashed:", error)
  process.exit(1)
})
