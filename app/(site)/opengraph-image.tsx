import { ImageResponse } from "next/og"

import { SITE } from "@/lib/site"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = SITE.name

/**
 * The site-wide social card. Deliberately typographic: no gradients, no glow,
 * one 1px rule and one accent dot, matching the design rules the pages follow.
 *
 * Only system font stacks are used. Fetching a webfont here would make the
 * build depend on the network, and this has to work offline.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          color: "#111111",
          padding: 80,
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: "#2563eb",
            }}
          />
          <div style={{ fontSize: 26, letterSpacing: -0.2 }}>{SITE.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 600,
              letterSpacing: -2,
              lineHeight: 1.05,
              maxWidth: 940,
            }}
          >
            Stop building what already exists.
          </div>
          <div style={{ height: 1, background: "#e5e5e5" }} />
          <div style={{ fontSize: 30, color: "#666666", maxWidth: 900 }}>
            Open-source tools a startup can run itself, grouped by the job they do.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#888888",
            fontFamily: "monospace",
          }}
        >
          Free · no login · no paywall
        </div>
      </div>
    ),
    size
  )
}
