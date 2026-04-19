import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const CACHE_DIR = join(homedir(), ".eshu")
const CACHE_PATH = join(CACHE_DIR, ".id-cache")
const MAX_ENTRIES = 1000

interface IdCache {
  /** Map of short ID (first 8 chars) to full UUID. */
  ids: Record<string, string>
}

function loadCache(): IdCache {
  try {
    const raw = readFileSync(CACHE_PATH, "utf-8")
    return JSON.parse(raw) as IdCache
  } catch {
    return { ids: {} }
  }
}

function saveCache(cache: IdCache): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true })
  }

  // Evict oldest entries if over limit
  const entries = Object.entries(cache.ids)
  if (entries.length > MAX_ENTRIES) {
    cache.ids = Object.fromEntries(entries.slice(-MAX_ENTRIES))
  }

  writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf-8")
}

/**
 * Cache UUIDs for later prefix resolution. Call after displaying
 * message listings (inbox, search, read).
 */
export function cacheIds(uuids: string[]): void {
  const cache = loadCache()
  for (const uuid of uuids) {
    cache.ids[uuid.slice(0, 8)] = uuid
  }
  saveCache(cache)
}

/**
 * Resolve a short ID prefix to a full UUID.
 *
 * - If the input is 36 chars (full UUID), returns it directly.
 * - Otherwise looks up the local cache for a prefix match.
 *
 * @returns The full UUID.
 * @throws If the ID is not found or is ambiguous.
 */
export function resolveId(input: string): string {
  // Full UUID — use directly
  if (input.length === 36) return input

  const cache = loadCache()

  // Exact match on 8-char short ID
  const exact = cache.ids[input]
  if (exact) return exact

  // Prefix match
  const matches = Object.entries(cache.ids).filter(([short]) => short.startsWith(input))

  if (matches.length === 0) {
    throw new Error(`Unknown message ID: "${input}". Run "eshu inbox" to refresh the ID cache.`)
  }
  if (matches.length > 1) {
    const options = matches.map(([short]) => short).join(", ")
    throw new Error(`Ambiguous ID prefix "${input}" matches: ${options}. Provide more characters.`)
  }

  return matches[0][1]
}
