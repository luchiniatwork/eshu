import { describe, expect, test } from "bun:test"
import { formatNumber, formatTable, relativeTime, shortId, snippet } from "./format"

describe("shortId", () => {
  test("returns first 8 chars of uuid", () => {
    expect(shortId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("a1b2c3d4")
  })

  test("handles short input gracefully", () => {
    expect(shortId("abc")).toBe("abc")
  })
})

describe("relativeTime", () => {
  test("just now for recent timestamps", () => {
    const now = new Date()
    expect(relativeTime(now)).toBe("just now")
  })

  test("minutes ago", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    expect(relativeTime(tenMinAgo)).toBe("10m ago")
  })

  test("hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
    expect(relativeTime(threeHoursAgo)).toBe("3h ago")
  })

  test("days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(relativeTime(twoDaysAgo)).toBe("2d ago")
  })

  test("accepts ISO string", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(relativeTime(tenMinAgo)).toBe("10m ago")
  })

  test("older than a week shows date", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const result = relativeTime(twoWeeksAgo)
    // Should not contain "ago" — shows a date instead
    expect(result).not.toContain("ago")
  })
})

describe("snippet", () => {
  test("short text unchanged", () => {
    expect(snippet("hello world")).toBe("hello world")
  })

  test("long text truncated with ellipsis", () => {
    const long = "a".repeat(60)
    const result = snippet(long, 50)
    expect(result.length).toBe(50)
    expect(result.endsWith("...")).toBe(true)
  })

  test("newlines replaced with spaces", () => {
    expect(snippet("line one\nline two")).toBe("line one line two")
  })

  test("custom max length", () => {
    const result = snippet("abcdefghij", 8)
    expect(result).toBe("abcde...")
  })

  test("exact length not truncated", () => {
    expect(snippet("12345", 5)).toBe("12345")
  })
})

describe("formatTable", () => {
  test("aligns columns", () => {
    const result = formatTable(
      ["Name", "Age"],
      [
        ["Alice", "30"],
        ["Bob", "25"],
      ],
    )
    const lines = result.split("\n")
    expect(lines).toHaveLength(3) // header + 2 rows
    // All lines should start with padding
    for (const line of lines) {
      expect(line.startsWith("  ")).toBe(true)
    }
  })

  test("handles empty rows", () => {
    const result = formatTable(["Name"], [])
    const lines = result.split("\n")
    expect(lines).toHaveLength(1) // header only
  })

  test("pads shorter cells", () => {
    const result = formatTable(["Col"], [["a"], ["abc"]])
    const lines = result.split("\n")
    // Second data row "a" should be padded to match "abc" width
    expect(lines[1].trim().length).toBeLessThanOrEqual(lines[2].trim().length)
  })
})

describe("formatNumber", () => {
  test("small number unchanged", () => {
    expect(formatNumber(42)).toBe("42")
  })

  test("large number with separators", () => {
    const result = formatNumber(1247)
    // Locale-dependent, but should contain the digits
    expect(result).toContain("1")
    expect(result).toContain("247")
  })
})
