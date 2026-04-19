import { describe, expect, test } from "bun:test"
import { AddressError } from "@eshu/shared"
import { Hono } from "hono"
import { ZodError } from "zod"
import { authMiddleware } from "./middleware/auth"
import { handleError } from "./middleware/error-handler"
import { identityMiddleware } from "./middleware/identity"
import type { AppEnv } from "./types"

// ---------------------------------------------------------------------------
// authMiddleware
// ---------------------------------------------------------------------------

describe("authMiddleware", () => {
  function createApp(apiKey: string | null) {
    const app = new Hono<AppEnv>()
    app.use("*", async (c, next) => {
      c.set("config", { apiKey } as AppEnv["Variables"]["config"])
      return next()
    })
    app.use("*", authMiddleware())
    app.get("/test", (c) => c.json({ ok: true }))
    return app
  }

  test("passes when no API key configured", async () => {
    const app = createApp(null)
    const res = await app.request("/test")
    expect(res.status).toBe(200)
  })

  test("rejects missing auth header when API key set", async () => {
    const app = createApp("secret-key")
    const res = await app.request("/test")
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("Authorization")
  })

  test("rejects invalid token", async () => {
    const app = createApp("secret-key")
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer wrong-key" },
    })
    expect(res.status).toBe(401)
  })

  test("rejects non-Bearer auth scheme", async () => {
    const app = createApp("secret-key")
    const res = await app.request("/test", {
      headers: { Authorization: "Basic c2VjcmV0" },
    })
    expect(res.status).toBe(401)
  })

  test("passes with valid token", async () => {
    const app = createApp("secret-key")
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer secret-key" },
    })
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// identityMiddleware
// ---------------------------------------------------------------------------

describe("identityMiddleware", () => {
  function createApp() {
    const app = new Hono<AppEnv>()
    app.use("*", identityMiddleware())
    app.get("/test", (c) => c.json({ address: c.get("callerAddress") }))
    return app
  }

  test("rejects missing X-Eshu-Address header", async () => {
    const app = createApp()
    const res = await app.request("/test")
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("X-Eshu-Address")
  })

  test("rejects invalid address (uppercase)", async () => {
    const app = createApp()
    const res = await app.request("/test", {
      headers: { "X-Eshu-Address": "ALICE" },
    })
    expect(res.status).toBe(400)
  })

  test("rejects invalid address (special chars)", async () => {
    const app = createApp()
    const res = await app.request("/test", {
      headers: { "X-Eshu-Address": "alice@bob" },
    })
    expect(res.status).toBe(400)
  })

  test("sets callerAddress for bare human address", async () => {
    const app = createApp()
    const res = await app.request("/test", {
      headers: { "X-Eshu-Address": "alice" },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { address: string }
    expect(body.address).toBe("alice")
  })

  test("sets callerAddress for agent address", async () => {
    const app = createApp()
    const res = await app.request("/test", {
      headers: { "X-Eshu-Address": "alice/code-reviewer" },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { address: string }
    expect(body.address).toBe("alice/code-reviewer")
  })

  test("sets callerAddress for autonomous agent", async () => {
    const app = createApp()
    const res = await app.request("/test", {
      headers: { "X-Eshu-Address": "auto/ci-fixer" },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { address: string }
    expect(body.address).toBe("auto/ci-fixer")
  })
})

// ---------------------------------------------------------------------------
// handleError
// ---------------------------------------------------------------------------

describe("handleError", () => {
  test("handles ZodError with 400 and field details", async () => {
    const app = new Hono<AppEnv>()
    app.onError(handleError)
    app.get("/test", () => {
      throw new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
          path: ["body"],
          message: "Required",
        },
      ])
    })

    const res = await app.request("/test")
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string; details: Array<{ path: string }> }
    expect(body.error).toBe("Validation error")
    expect(body.details).toHaveLength(1)
    expect(body.details[0].path).toBe("body")
  })

  test("handles AddressError with 400", async () => {
    const app = new Hono<AppEnv>()
    app.onError(handleError)
    app.get("/test", () => {
      throw new AddressError("bad address")
    })

    const res = await app.request("/test")
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("bad address")
  })

  test("handles SyntaxError with 400", async () => {
    const app = new Hono<AppEnv>()
    app.onError(handleError)
    app.get("/test", () => {
      throw new SyntaxError("Unexpected token")
    })

    const res = await app.request("/test")
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("JSON")
  })

  test("handles unknown error with 500", async () => {
    // Suppress console.error during this test (handleError logs unknown errors)
    const origConsoleError = console.error
    console.error = () => {}
    try {
      const err = new Error("something went wrong")
      const mockJson = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), { status })
      const res = await handleError(err, {
        json: mockJson,
      } as Parameters<typeof handleError>[1])
      expect(res.status).toBe(500)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe("something went wrong")
    } finally {
      console.error = origConsoleError
    }
  })
})
