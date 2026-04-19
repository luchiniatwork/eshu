import { validateAddress } from "@eshu/shared"
import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../types"

/**
 * Identity middleware. Extracts the caller's address from the
 * `X-Eshu-Address` header, validates it, and sets it on the context.
 */
export function identityMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const address = c.req.header("X-Eshu-Address")
    if (!address) {
      return c.json({ error: "Missing X-Eshu-Address header" }, 401)
    }

    try {
      validateAddress(address)
    } catch {
      return c.json({ error: `Invalid caller address: "${address}"` }, 400)
    }

    c.set("callerAddress", address)
    return next()
  }
}
