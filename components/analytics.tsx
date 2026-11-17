/**
 * Cloudflare Web Analytics, loaded only when a token is configured.
 *
 * Why this one: it counts unique visitors without a cookie, which means no
 * consent banner is needed and nothing personal is stored. That matters for a
 * site whose whole premise is "free, no login, no account" — bolting Google
 * Analytics onto it would contradict the footer.
 *
 * Gated on the env var so the site works identically with it unset. An
 * analytics integration that half-loads is worse than none: it costs a
 * request and reports nothing.
 *
 * NEXT_PUBLIC_ is correct here and is not a leak. The beacon token is a
 * public site identifier — it is visible in the page source of every site
 * using Cloudflare analytics by design, and it grants no access to anything.
 * It is the one category of value that genuinely belongs in a client bundle.
 *
 * The CSP in next.config.ts must allow `static.cloudflareinsights.com` in
 * script-src and `cloudflareinsights.com` in connect-src, or the browser
 * blocks this silently and you get zero visitors with no error anywhere.
 */
export function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN?.trim()
  if (!token) return null

  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  )
}
