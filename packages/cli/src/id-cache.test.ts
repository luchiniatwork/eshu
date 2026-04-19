import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { cacheIds, resolveId } from "./id-cache"

const CACHE_DIR = join(homedir(), ".eshu")
const CACHE_PATH = join(CACHE_DIR, ".id-cache")

describe("id-cache", () => {
  let savedCache: string | null = null

  beforeEach(() => {
    // Ensure cache directory exists
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true })
    }
    // Save existing cache if present
    try {
      savedCache = readFileSync(CACHE_PATH, "utf-8")
    } catch {
      savedCache = null
    }
    // Write empty cache
    writeFileSync(CACHE_PATH, JSON.stringify({ ids: {} }), "utf-8")
  })

  afterEach(() => {
    // Restore original cache
    if (savedCache !== null) {
      writeFileSync(CACHE_PATH, savedCache, "utf-8")
    } else if (existsSync(CACHE_PATH)) {
      writeFileSync(CACHE_PATH, JSON.stringify({ ids: {} }), "utf-8")
    }
  })

  test("cache and resolve full uuid", () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    // Full UUIDs pass through without needing cache
    expect(resolveId(uuid)).toBe(uuid)
  })

  test("cache and resolve short id", () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    cacheIds([uuid])
    expect(resolveId("a1b2c3d4")).toBe(uuid)
  })

  test("resolve by prefix", () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    cacheIds([uuid])
    expect(resolveId("a1b2")).toBe(uuid)
  })

  test("multiple ids cached", () => {
    const uuid1 = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    const uuid2 = "b2c3d4e5-f6a7-8901-bcde-f12345678901"
    cacheIds([uuid1, uuid2])
    expect(resolveId("a1b2c3d4")).toBe(uuid1)
    expect(resolveId("b2c3d4e5")).toBe(uuid2)
  })

  test("throws on unknown id", () => {
    expect(() => resolveId("deadbeef")).toThrow("Unknown message ID")
  })

  test("throws on ambiguous prefix", () => {
    const uuid1 = "aabb1122-0000-0000-0000-000000000001"
    const uuid2 = "aabb3344-0000-0000-0000-000000000002"
    cacheIds([uuid1, uuid2])
    expect(() => resolveId("aabb")).toThrow("Ambiguous ID prefix")
  })

  test("merges with existing cache", () => {
    const uuid1 = "11111111-0000-0000-0000-000000000001"
    const uuid2 = "22222222-0000-0000-0000-000000000002"
    cacheIds([uuid1])
    cacheIds([uuid2])
    // Both should be resolvable
    expect(resolveId("11111111")).toBe(uuid1)
    expect(resolveId("22222222")).toBe(uuid2)
  })
})
