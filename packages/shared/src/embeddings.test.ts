import { describe, expect, test } from "bun:test"
import { fromVectorString, toVectorString } from "./embeddings"

describe("toVectorString", () => {
  test("formats embedding as pgvector string", () => {
    const embedding = [0.1, 0.2, 0.3]
    expect(toVectorString(embedding)).toBe("[0.1,0.2,0.3]")
  })

  test("handles empty array", () => {
    expect(toVectorString([])).toBe("[]")
  })

  test("handles single element", () => {
    expect(toVectorString([0.5])).toBe("[0.5]")
  })
})

describe("fromVectorString", () => {
  test("parses pgvector string to number array", () => {
    const result = fromVectorString("[0.1,0.2,0.3]")
    expect(result).toEqual([0.1, 0.2, 0.3])
  })

  test("handles empty vector", () => {
    expect(fromVectorString("[]")).toEqual([])
  })

  test("handles single element", () => {
    expect(fromVectorString("[0.5]")).toEqual([0.5])
  })

  test("roundtrip", () => {
    const original = [0.123, -0.456, 0.789]
    const result = fromVectorString(toVectorString(original))
    expect(result).toEqual(original)
  })
})

// Integration test: requires OPENAI_API_KEY
// Run with: OPENAI_API_KEY=sk-... bun test src/embeddings.test.ts
describe.skipIf(!process.env.OPENAI_API_KEY)("embed (integration)", () => {
  const { embed } = require("./embeddings")

  test("generates 1536-dim vector", async () => {
    const result = await embed("Hello, world!", process.env.OPENAI_API_KEY!)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(1536)
    expect(typeof result[0]).toBe("number")
  })
})
