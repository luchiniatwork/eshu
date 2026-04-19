import pc from "picocolors"

// ---------------------------------------------------------------------------
// Short ID display
// ---------------------------------------------------------------------------

/** Show first 8 chars of a UUID for compact display. */
export function shortId(uuid: string): string {
  return uuid.slice(0, 8)
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

/** Format a date as relative time (e.g. "10m ago", "2h ago", "3d ago"). */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return d.toLocaleDateString()
}

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

/**
 * Render a table with aligned columns. Pads columns to fit the widest value
 * in each column.
 */
export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => stripAnsi(r[i] ?? "").length)),
  )

  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join("  ")

  const rowLines = rows.map((row) =>
    row
      .map((cell, i) => {
        const stripped = stripAnsi(cell ?? "")
        const pad = widths[i] - stripped.length
        return (cell ?? "") + " ".repeat(Math.max(0, pad))
      })
      .join("  "),
  )

  return [`  ${pc.bold(headerLine)}`, ...rowLines.map((r) => `  ${r}`)].join("\n")
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Truncate text to maxLen, adding ellipsis if truncated. */
export function snippet(text: string, maxLen = 50): string {
  const oneLine = text.replace(/\n/g, " ").trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen - 3)}...`
}

/** Print a horizontal separator line. */
export function separator(width = 50): string {
  return pc.dim("─".repeat(width))
}

/** Print data as formatted JSON. */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

/** Format a number with commas (e.g. 1,247). */
export function formatNumber(n: number): string {
  return n.toLocaleString()
}

// ---------------------------------------------------------------------------
// ANSI stripping (for width calculation)
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ANSI escape matching
const ANSI_REGEX = /\x1b\[[0-9;]*m/g

/** Strip ANSI escape codes from a string for accurate width measurement. */
function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "")
}

// ---------------------------------------------------------------------------
// Re-export picocolors for use by command modules
// ---------------------------------------------------------------------------

export { pc }
