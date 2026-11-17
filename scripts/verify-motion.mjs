/**
 * Motion verification sweep.
 *
 * Checks the things animation is most likely to break: horizontal overflow,
 * cumulative layout shift, and console errors — at both a phone and a desktop
 * width, with motion on and with motion reduced.
 *
 * Run against a production server, not `next dev`: the dev overlay and HMR
 * both inject their own elements and would pollute every measurement.
 */
import { chromium } from "@playwright/test"

const BASE = process.env.BASE ?? "http://localhost:3000"

const PAGES = [
  ["/", "home"],
  ["/explore", "explore"],
  ["/c/ai-ml", "category"],
  ["/gems", "gems"],
  ["/r/supabase/supabase", "detail"],
  ["/ask", "ask"],
  ["/stacks", "stacks"],
]

const VIEWPORTS = [
  { name: "390px", width: 390, height: 844 },
  { name: "1440px", width: 1440, height: 900 },
]

async function measure(context, path) {
  // A fresh page per measurement. Reusing one and calling addInitScript each
  // time registered a new PerformanceObserver per navigation, all adding to
  // the same counter -- which reported CLS 0.43 on the third page purely as
  // an artefact of being measured three times.
  const page = await context.newPage()
  const errors = []
  const onError = (msg) => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 140))
  }
  page.on("console", onError)
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 140)}`))

  // Start the CLS observer before navigation so nothing is missed.
  await page.addInitScript(() => {
    window.__cls = 0
    window.__shifts = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue
        window.__cls += entry.value
        window.__shifts.push({
          v: Number(entry.value.toFixed(4)),
          t: Math.round(entry.startTime),
          src: (entry.sources || []).slice(0, 2).map((s) =>
            s.node
              ? `${s.node.tagName?.toLowerCase()}.${String(s.node.className || "").slice(0, 38)} y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`
              : "?"
          ),
        })
      }
    }).observe({ type: "layout-shift", buffered: true })
  })

  await page.goto(BASE + path, { waitUntil: "load" })
  // Let entrance animations, scroll reveals and the count-up all finish.
  await page.waitForTimeout(1800)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
  // Long enough for a full stagger to finish: 24 cards x 40ms apart plus a
  // 320ms item duration is ~1.3s. At 900ms the tail was still animating and
  // got reported as stuck.
  await page.waitForTimeout(2000)

  const result = await page.evaluate(() => ({
    cls: Number((window.__cls ?? 0).toFixed(4)),
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    // Anything actually sticking out past the viewport edge.
    overflowing: [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`),
    // Did content actually render, or did something animate to opacity 0 and stay?
    shifts: (window.__shifts ?? []).slice(0, 3),
    visibleText: document.body.innerText.trim().length,
    invisible: [...document.querySelectorAll("main *")].filter((el) => {
      const s = getComputedStyle(el)
      return (
        s.opacity === "0" &&
        el.getBoundingClientRect().height > 20 &&
        el.textContent.trim().length > 20
      )
    }).length,
  }))

  await page.close()
  return { ...result, errors }
}

const browser = await chromium.launch()
let failures = 0

for (const reducedMotion of ["no-preference", "reduce"]) {
  console.log(`\n===== prefers-reduced-motion: ${reducedMotion} =====`)

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion,
    })

    for (const [path, label] of PAGES) {
      const r = await measure(context, path)
      const overflow = r.docW > r.winW + 1
      const badCls = r.cls > 0.1
      const stuck = r.invisible > 0
      const empty = r.visibleText < 200
      const bad = overflow || badCls || stuck || empty || r.errors.length > 0
      if (bad) failures++

      console.log(
        `${bad ? "FAIL" : "ok  "} ${vp.name.padEnd(7)} ${label.padEnd(9)} ` +
          `CLS=${String(r.cls).padEnd(7)} w=${r.docW}/${r.winW} ` +
          `text=${r.visibleText} stuck=${r.invisible}` +
          (r.errors.length ? ` errors=${r.errors.length}` : "")
      )
      if (badCls) for (const s of r.shifts) console.log(`      shift ${s.v} @${s.t}ms  ${s.src.join(" | ")}`)
      if (overflow) console.log(`      overflow by ${r.docW - r.winW}px: ${r.overflowing.join(" | ")}`)
      if (r.errors.length) r.errors.slice(0, 2).forEach((e) => console.log(`      ${e}`))
    }

    await context.close()
  }
}

await browser.close()
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`)
process.exit(failures === 0 ? 0 : 1)
