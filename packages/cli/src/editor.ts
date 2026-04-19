import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * Open content in the user's preferred editor ($VISUAL, $EDITOR, or vi)
 * and return the edited content. Comment lines (starting with #) are
 * stripped from the result.
 *
 * @returns The edited content with comment lines removed, or null if
 *          the editor exited with a non-zero code or the content is empty.
 */
export function editInEditor(initial = ""): string | null {
  const editor = process.env.VISUAL ?? process.env.EDITOR ?? "vi"

  const dir = mkdtempSync(join(tmpdir(), "eshu-"))
  const file = join(dir, "message.md")

  writeFileSync(file, initial, "utf-8")

  const result = spawnSync(editor, [file], {
    stdio: "inherit",
    shell: true,
  })

  if (result.status !== 0) {
    cleanup(dir)
    return null
  }

  const content = readFileSync(file, "utf-8")
  cleanup(dir)

  // Strip comment lines (lines starting with #)
  const stripped = content
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n")
    .trim()

  return stripped || null
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true })
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Parse a message template that has headers (Key: Value) separated
 * from the body by a blank line or "---".
 *
 * @returns Parsed headers and body.
 */
export function parseTemplate(content: string): {
  headers: Record<string, string>
  body: string
} {
  const lines = content.split("\n")
  const headers: Record<string, string> = {}
  let bodyStart = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === "---" || line.trim() === "") {
      bodyStart = i + 1
      break
    }
    const match = line.match(/^([A-Za-z-]+):\s*(.*)$/)
    if (match) {
      headers[match[1].toLowerCase()] = match[2].trim()
    } else {
      bodyStart = i
      break
    }
  }

  return {
    headers,
    body: lines.slice(bodyStart).join("\n").trim(),
  }
}
