/**
 * URL and JSON-LD escaping for values this project does not author.
 *
 * Every repo field in the catalogue is written by whoever owns that GitHub
 * repository. The weekly discovery Action imports new ones automatically, so
 * "nothing dangerous is in the data today" is a statement about today, not a
 * control. These two helpers are the controls.
 */

/**
 * Schemes allowed in an `href`.
 *
 * `z.url()` is not a safety check: it accepts `javascript:alert(1)` and
 * `data:text/html,<script>...` as perfectly valid URLs, and both were
 * accepted by the schema before this existed. A repo's `homepage` comes
 * straight from its owner and is rendered as a link on the detail page, so a
 * scheme allowlist is the thing standing between that and a click-to-XSS.
 */
const SAFE_SCHEMES = new Set(["http:", "https:"])

export function isSafeHttpUrl(value: string | undefined): boolean {
  if (!value) return false
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return SAFE_SCHEMES.has(parsed.protocol)
}

/** The URL if it is safe to put in an href, otherwise undefined. */
export function safeHref(value: string | undefined): string | undefined {
  return isSafeHttpUrl(value) ? value : undefined
}

/**
 * Serialise an object for embedding in `<script type="application/ld+json">`.
 *
 * `JSON.stringify` escapes quotes and backslashes. It does not escape `<`,
 * which is the only character that matters here: a description containing a
 * closing script tag ends the element early, and everything after it is
 * parsed as HTML. That was live -- 14 catalogue descriptions already contain
 * `<` or `>`, one of them literally `</>`, and any repo owner can put a
 * closing script tag in theirs and wait for the weekly import.
 *
 * Replacing each with a \uXXXX escape leaves the JSON equivalent to any
 * parser -- it decodes to the same string -- while making it inert to the
 * HTML tokeniser.
 */

/**
 * The characters to neutralise, by code point.
 *
 * Built from code points rather than written into the source. U+2028 and
 * U+2029 are invisible line terminators; a raw one pasted into a regex
 * literal is unreviewable and is mangled by ordinary tooling, which this
 * file lost twice before being written this way. Naming the code point
 * keeps the source pure ASCII and says exactly what is meant.
 */
const UNSAFE_CODE_POINTS = [
  0x3c, // "<", which can close a script element
  0x3e, // ">"
  0x26, // "&"
  0x2028, // line separator: legal inside a JSON string, a newline to a JS parser
  0x2029, // paragraph separator: same problem
]

const JSON_LD_ESCAPES = new Map(
  UNSAFE_CODE_POINTS.map((code) => [
    String.fromCodePoint(code),
    "\\u" + code.toString(16).padStart(4, "0"),
  ])
)

const JSON_LD_UNSAFE = new RegExp("[" + [...JSON_LD_ESCAPES.keys()].join("") + "]", "g")

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(
    JSON_LD_UNSAFE,
    (char) => JSON_LD_ESCAPES.get(char) ?? char
  )
}
