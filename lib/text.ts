/**
 * Normalization applied to GitHub-authored descriptions before they are stored.
 *
 * The text stays verbatim apart from decoration: the design rules ban emoji as
 * iconography, and a description ending in ":bar_chart:" reads as a rendering
 * bug rather than as content. Nothing is rewritten, summarised, or generated.
 */

/** Legal marks are content, not decoration. */
const KEEP_SYMBOLS = new Set(["®", "™", "©"])

/**
 * GitHub shortcodes like `:bar_chart:`. Required to start with a letter so a
 * ratio such as "3:4:5" is left alone.
 */
const SHORTCODE = /:[a-z][a-z0-9_+-]+:/g

const PICTOGRAPH = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu

export function cleanDescription(value: string): string {
  return value
    .replace(PICTOGRAPH, (char) => (KEEP_SYMBOLS.has(char) ? char : ""))
    .replace(SHORTCODE, "")
    // Collapse the whitespace the removals leave behind, then tidy a trailing
    // separator that was only there to hold the emoji up.
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/[\s·|-]+$/, "")
    .trim()
}
