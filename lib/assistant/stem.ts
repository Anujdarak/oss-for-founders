/**
 * A deliberately small suffix stemmer.
 *
 * Measured need, not a guess: the first run of the query suite failed 14 of 60
 * and most failures were pure morphology. "scan my code for vulnerabilities"
 * resolved to no need at all because the taxonomy says `vulnerability`;
 * "scrape data" missed `scraping`; "my app crashes" missed `crash-reporting`;
 * "translate my app" missed `translation`; "end to end browser tests" missed
 * `testing`. Every one of those is the same word in a different form.
 *
 * A full Porter stemmer would be more correct and much more aggressive —
 * it conflates "universal" and "university", which in a catalogue of developer
 * tools is exactly the kind of collision that produces a baffling result. This
 * strips the handful of endings that actually appear in the gap between how a
 * founder types and how a repo tags itself, and stops there.
 */
export function stem(word: string): string {
  let out = word
  if (out.length <= 3) return out

  if (out.endsWith("ies") && out.length > 4) out = out.slice(0, -3) + "y"
  else if (out.endsWith("sses")) out = out.slice(0, -2)
  else if (out.endsWith("es") && out.length > 4 && !/[aeiou]es$/.test(out)) out = out.slice(0, -2)
  else if (out.endsWith("s") && !/(ss|us|is)$/.test(out)) out = out.slice(0, -1)

  if (out.endsWith("ation") && out.length > 6) out = out.slice(0, -3)
  else if (out.endsWith("ing") && out.length > 5) out = out.slice(0, -3)
  else if (out.endsWith("ed") && out.length > 4) out = out.slice(0, -2)

  if (out.endsWith("ity") && out.length > 5) out = out.slice(0, -3)
  else if (out.endsWith("ion") && out.length > 5) out = out.slice(0, -3)
  else if (out.endsWith("er") && out.length > 4) out = out.slice(0, -2)
  else if (out.endsWith("ment") && out.length > 6) out = out.slice(0, -4)

  // "translate" -> "translat" so it meets "translation" -> "translat".
  if (out.endsWith("e") && out.length > 4) out = out.slice(0, -1)
  // "scanner" -> "scann" -> "scan", meeting "scan".
  out = out.replace(/([a-z])\1$/, "$1")

  return out
}

export function stemAll(words: string[]): string[] {
  return words.map(stem)
}
