import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../types"

/**
 * Bearer token authentication middleware.
 * If `config.apiKey` is set, all requests must include a valid
 * `Authorization: Bearer <key>` header. If not set, auth is skipped.
 */
export function authMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const config = c.get("config")

    // No API key configured — skip auth (development mode)
    if (!config.apiKey) {
      return next()
    }

    const authHeader = c.req.header("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401)
    }

    const token = authHeader.slice(7)
    if (token !== config.apiKey) {
      return c.json({ error: "Invalid API key" }, 401)
    }

    return next()
  }
}
