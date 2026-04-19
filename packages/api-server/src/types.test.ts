import { describe, expect, test } from "bun:test"
import {
  DirectoryAddSchema,
  DirectoryListSchema,
  DirectoryUpdateSchema,
  InboxSchema,
  ReadMessageSchema,
  SearchSchema,
  SendMessageSchema,
} from "./types"

// ---------------------------------------------------------------------------
// DirectoryListSchema
// ---------------------------------------------------------------------------

describe("DirectoryListSchema", () => {
  test("accepts empty body", () => {
    const result = DirectoryListSchema.parse({})
    expect(result.type).toBeUndefined()
  })

  test("accepts human type filter", () => {
    const result = DirectoryListSchema.parse({ type: "human" })
    expect(result.type).toBe("human")
  })

  test("accepts agent type filter", () => {
    const result = DirectoryListSchema.parse({ type: "agent" })
    expect(result.type).toBe("agent")
  })

  test("rejects invalid type", () => {
    expect(() => DirectoryListSchema.parse({ type: "robot" })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DirectoryAddSchema
// ---------------------------------------------------------------------------

describe("DirectoryAddSchema", () => {
  test("accepts valid entry", () => {
    const result = DirectoryAddSchema.parse({
      address: "alice",
      displayName: "Alice",
      type: "human",
    })
    expect(result.address).toBe("alice")
    expect(result.type).toBe("human")
  })

  test("accepts optional fields", () => {
    const result = DirectoryAddSchema.parse({
      address: "auto/ci-fixer",
      displayName: "CI Bot",
      type: "agent",
      description: "Fixes CI",
      expectations: "Send logs",
    })
    expect(result.description).toBe("Fixes CI")
    expect(result.expectations).toBe("Send logs")
  })

  test("rejects missing address", () => {
    expect(() => DirectoryAddSchema.parse({ displayName: "Alice", type: "human" })).toThrow()
  })

  test("rejects missing displayName", () => {
    expect(() => DirectoryAddSchema.parse({ address: "alice", type: "human" })).toThrow()
  })

  test("rejects invalid type", () => {
    expect(() =>
      DirectoryAddSchema.parse({ address: "alice", displayName: "Alice", type: "bot" }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DirectoryUpdateSchema
// ---------------------------------------------------------------------------

describe("DirectoryUpdateSchema", () => {
  test("accepts displayName update", () => {
    const result = DirectoryUpdateSchema.parse({ displayName: "New Name" })
    expect(result.displayName).toBe("New Name")
  })

  test("accepts description update", () => {
    const result = DirectoryUpdateSchema.parse({ description: "New description" })
    expect(result.description).toBe("New description")
  })

  test("accepts nullable description", () => {
    const result = DirectoryUpdateSchema.parse({ description: null })
    expect(result.description).toBeNull()
  })

  test("rejects empty update", () => {
    expect(() => DirectoryUpdateSchema.parse({})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// InboxSchema
// ---------------------------------------------------------------------------

describe("InboxSchema", () => {
  test("applies defaults for empty body", () => {
    const result = InboxSchema.parse({})
    expect(result.unreadOnly).toBe(true)
    expect(result.mode).toBe("threaded")
    expect(result.limit).toBe(20)
    expect(result.includeArchived).toBe(false)
  })

  test("accepts flat mode", () => {
    const result = InboxSchema.parse({ mode: "flat" })
    expect(result.mode).toBe("flat")
  })

  test("accepts custom limit", () => {
    const result = InboxSchema.parse({ limit: 50 })
    expect(result.limit).toBe(50)
  })

  test("rejects limit over 100", () => {
    expect(() => InboxSchema.parse({ limit: 200 })).toThrow()
  })

  test("rejects negative limit", () => {
    expect(() => InboxSchema.parse({ limit: -1 })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// ReadMessageSchema
// ---------------------------------------------------------------------------

describe("ReadMessageSchema", () => {
  test("defaults includeThread to false", () => {
    const result = ReadMessageSchema.parse({})
    expect(result.includeThread).toBe(false)
  })

  test("accepts includeThread true", () => {
    const result = ReadMessageSchema.parse({ includeThread: true })
    expect(result.includeThread).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SearchSchema
// ---------------------------------------------------------------------------

describe("SearchSchema", () => {
  test("requires query", () => {
    expect(() => SearchSchema.parse({})).toThrow()
  })

  test("rejects empty query", () => {
    expect(() => SearchSchema.parse({ query: "" })).toThrow()
  })

  test("accepts valid query with defaults", () => {
    const result = SearchSchema.parse({ query: "connection pool" })
    expect(result.query).toBe("connection pool")
    expect(result.folder).toBe("inbox")
    expect(result.limit).toBe(20)
    expect(result.includeArchived).toBe(false)
  })

  test("accepts sent folder", () => {
    const result = SearchSchema.parse({ query: "test", folder: "sent" })
    expect(result.folder).toBe("sent")
  })

  test("accepts all folder", () => {
    const result = SearchSchema.parse({ query: "test", folder: "all" })
    expect(result.folder).toBe("all")
  })
})

// ---------------------------------------------------------------------------
// SendMessageSchema
// ---------------------------------------------------------------------------

describe("SendMessageSchema", () => {
  test("requires body", () => {
    expect(() => SendMessageSchema.parse({})).toThrow()
  })

  test("rejects empty body", () => {
    expect(() => SendMessageSchema.parse({ body: "" })).toThrow()
  })

  test("accepts new message with to, subject, body", () => {
    const result = SendMessageSchema.parse({
      to: ["alice"],
      subject: "Hello",
      body: "World",
    })
    expect(result.to).toEqual(["alice"])
    expect(result.subject).toBe("Hello")
    expect(result.body).toBe("World")
    expect(result.receiptRequested).toBe(false)
  })

  test("accepts reply with just body and inReplyTo", () => {
    const result = SendMessageSchema.parse({
      body: "Reply text",
      inReplyTo: "550e8400-e29b-41d4-a716-446655440000",
    })
    expect(result.body).toBe("Reply text")
    expect(result.inReplyTo).toBe("550e8400-e29b-41d4-a716-446655440000")
    expect(result.to).toBeUndefined()
    expect(result.subject).toBeUndefined()
  })

  test("rejects invalid UUID for inReplyTo", () => {
    expect(() => SendMessageSchema.parse({ body: "Reply", inReplyTo: "not-a-uuid" })).toThrow()
  })

  test("accepts receiptRequested", () => {
    const result = SendMessageSchema.parse({
      to: ["bob"],
      subject: "Test",
      body: "Hello",
      receiptRequested: true,
    })
    expect(result.receiptRequested).toBe(true)
  })

  test("accepts multiple recipients", () => {
    const result = SendMessageSchema.parse({
      to: ["alice", "bob", "auto/ci-fixer"],
      subject: "Team update",
      body: "Status report",
    })
    expect(result.to).toHaveLength(3)
  })
})
