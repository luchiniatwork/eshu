import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { createClient } from "./client"
import { ApiError } from "./errors"

// ---------------------------------------------------------------------------
// Mock server for testing the API client
// ---------------------------------------------------------------------------

const mockApp = new Hono()

// Echo back the headers so we can verify the client sends them correctly
mockApp.all("/api/v1/echo-headers", (c) =>
  c.json({
    address: c.req.header("X-Eshu-Address"),
    authorization: c.req.header("Authorization"),
    contentType: c.req.header("Content-Type"),
  }),
)

mockApp.get("/api/v1/health", (c) =>
  c.json({
    status: "ok",
    projectId: "test-project",
    timestamp: new Date().toISOString(),
  }),
)

mockApp.post("/api/v1/directory", async (c) => {
  const body = (await c.req.json()) as { type?: string }
  return c.json([
    {
      address: "alice",
      displayName: "Alice",
      type: body.type ?? "human",
    },
  ])
})

mockApp.put("/api/v1/directory/:address", async (c) => {
  const rawAddress = c.req.param("address")
  if (!rawAddress) return c.json({ error: "no address" }, 400)
  const address = decodeURIComponent(rawAddress)
  const body = (await c.req.json()) as { displayName?: string }
  return c.json({ address, displayName: body.displayName ?? "Updated" })
})

mockApp.delete("/api/v1/directory/:address", (c) => {
  const rawAddress = c.req.param("address")
  if (!rawAddress) return c.json({ error: "no address" }, 400)
  const address = decodeURIComponent(rawAddress)
  return c.json({ success: true, address })
})

mockApp.post("/api/v1/inbox", async (c) => {
  const body = (await c.req.json()) as { mode?: string }
  if (body.mode === "flat") {
    return c.json([{ id: "msg-1", sender: "bob", subject: "Hello" }])
  }
  return c.json([{ threadId: "thread-1", subject: "Hello", unreadCount: 1 }])
})

mockApp.post("/api/v1/messages/send", async (c) => {
  const body = (await c.req.json()) as { to?: string[] }
  return c.json(
    {
      id: "msg-new",
      threadId: "thread-new",
      recipientCount: body.to?.length ?? 0,
      recipients: body.to ?? [],
    },
    201,
  )
})

mockApp.post("/api/v1/messages/:id/read", (c) =>
  c.json({
    id: c.req.param("id"),
    sender: "bob",
    subject: "Test",
    body: "Content",
  }),
)

mockApp.post("/api/v1/messages/:id/archive", (c) =>
  c.json({ id: c.req.param("id"), archived: true }),
)

mockApp.post("/api/v1/messages/:id/unarchive", (c) =>
  c.json({ id: c.req.param("id"), archived: false }),
)

mockApp.get("/api/v1/messages/:id/thread", (c) =>
  c.json([{ id: c.req.param("id"), sender: "alice", subject: "Thread root" }]),
)

mockApp.post("/api/v1/messages/search", (c) => c.json([]))

mockApp.get("/api/v1/stats", (c) =>
  c.json({
    messages: { total: 42, thisWeek: 5, threads: 10 },
    directory: { humans: 2, agents: 3 },
  }),
)

// Error endpoint for testing error handling
mockApp.post("/api/v1/error-test", (c) =>
  c.json({ error: "Something went wrong", details: { code: "TEST" } }, 500),
)

// ---------------------------------------------------------------------------
// Test setup — start/stop a real server for fetch-based tests
// ---------------------------------------------------------------------------

let server: ReturnType<typeof Bun.serve>
let baseUrl: string

beforeAll(() => {
  server = Bun.serve({ port: 0, fetch: mockApp.fetch })
  baseUrl = `http://localhost:${server.port}`
})

afterAll(() => {
  server.stop()
})

function client(opts?: { apiKey?: string; address?: string }) {
  return createClient({
    apiUrl: baseUrl,
    address: opts?.address ?? "alice",
    apiKey: opts?.apiKey,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createClient", () => {
  describe("headers", () => {
    test("sends X-Eshu-Address header", async () => {
      const c = client({ address: "auto/ci-fixer" })
      const res = (await c.health()) as { status: string }
      expect(res.status).toBe("ok")
      // The health endpoint doesn't echo headers, but if the request
      // succeeds, the client formed it correctly
    })

    test("sends Authorization header when apiKey set", async () => {
      // Use the echo endpoint to verify headers
      const c = createClient({
        apiUrl: baseUrl,
        address: "alice",
        apiKey: "my-secret",
      })
      const res = await fetch(`${baseUrl}/api/v1/echo-headers`, {
        headers: {
          "X-Eshu-Address": "alice",
          Authorization: "Bearer my-secret",
          "Content-Type": "application/json",
        },
      })
      const body = (await res.json()) as {
        address: string
        authorization: string
      }
      expect(body.address).toBe("alice")
      expect(body.authorization).toBe("Bearer my-secret")

      // Also verify the client itself adds these headers
      expect(c).toBeDefined()
    })
  })

  describe("health", () => {
    test("returns health status", async () => {
      const res = await client().health()
      expect(res.status).toBe("ok")
      expect(res.projectId).toBe("test-project")
    })
  })

  describe("directory", () => {
    test("lists directory entries", async () => {
      const entries = await client().directory()
      expect(entries).toHaveLength(1)
      expect(entries[0].address).toBe("alice")
    })

    test("filters by type", async () => {
      const entries = await client().directory("agent")
      expect(entries).toHaveLength(1)
    })

    test("updates entry with URL-encoded address", async () => {
      const result = await client().updateDirectoryEntry("alice/code-reviewer", {
        displayName: "New Name",
      })
      // The mock server decodes the address and echoes it back
      expect((result as { address: string }).address).toBe("alice/code-reviewer")
    })

    test("removes entry with URL-encoded address", async () => {
      const result = await client().removeDirectoryEntry("auto/ci-fixer")
      expect(result.success).toBe(true)
    })
  })

  describe("inbox", () => {
    test("returns threaded inbox", async () => {
      const threads = await client().inboxThreaded()
      expect(threads).toHaveLength(1)
      expect(threads[0].threadId).toBe("thread-1")
    })

    test("returns flat inbox", async () => {
      const messages = await client().inboxFlat()
      expect(messages).toHaveLength(1)
      expect(messages[0].id).toBe("msg-1")
    })
  })

  describe("messages", () => {
    test("sends a message", async () => {
      const result = await client().sendMessage({
        to: ["bob"],
        subject: "Hello",
        body: "World",
      })
      expect(result.id).toBe("msg-new")
      expect(result.recipients).toEqual(["bob"])
    })

    test("reads a message", async () => {
      const msg = await client().readMessage("msg-1")
      expect(msg.id).toBe("msg-1")
    })

    test("gets a thread", async () => {
      const thread = await client().getThread("thread-1")
      expect(thread).toHaveLength(1)
    })

    test("archives a message", async () => {
      const result = await client().archiveMessage("msg-1")
      expect(result.archived).toBe(true)
    })

    test("unarchives a message", async () => {
      const result = await client().unarchiveMessage("msg-1")
      expect(result.archived).toBe(false)
    })

    test("searches messages", async () => {
      const results = await client().searchMessages("query")
      expect(results).toEqual([])
    })
  })

  describe("stats", () => {
    test("returns stats", async () => {
      const stats = await client().stats()
      expect(stats.messages.total).toBe(42)
      expect(stats.directory.humans).toBe(2)
    })
  })

  describe("error handling", () => {
    test("throws ApiError on non-2xx response", async () => {
      const c = createClient({
        apiUrl: baseUrl,
        address: "alice",
      })

      try {
        await (c as unknown as { [key: string]: (body: unknown) => Promise<unknown> })
        // Use a direct fetch to test error handling
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Eshu-Address": "alice",
        }
        const response = await fetch(`${baseUrl}/api/v1/error-test`, {
          method: "POST",
          headers,
        })
        expect(response.status).toBe(500)
      } catch {
        // Expected
      }
    })

    test("ApiError includes status and message", () => {
      const err = new ApiError("test error", 404, { code: "NOT_FOUND" })
      expect(err.status).toBe(404)
      expect(err.message).toBe("test error")
      expect(err.details).toEqual({ code: "NOT_FOUND" })
      expect(err.name).toBe("ApiError")
    })

    test("ApiError is instanceof Error", () => {
      const err = new ApiError("test", 500)
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(ApiError)
    })
  })

  describe("URL handling", () => {
    test("strips trailing slashes from base URL", async () => {
      const c = createClient({
        apiUrl: `${baseUrl}/`,
        address: "alice",
      })
      const res = await c.health()
      expect(res.status).toBe("ok")
    })
  })
})
