import { AddressError } from "@eshu/shared"
import type { ErrorHandler } from "hono"
import { ZodError } from "zod"
import type { AppEnv } from "../types"

/**
 * Global error handler for the Hono app.
 * Catches known error types and returns structured JSON responses.
 */
export const handleError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: "Validation error",
        details: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
      400,
    )
  }

  if (err instanceof AddressError) {
    return c.json({ error: err.message }, 400)
  }

  if (err instanceof SyntaxError) {
    return c.json({ error: "Invalid JSON in request body" }, 400)
  }

  console.error("Unhandled error:", err)
  const message = err instanceof Error ? err.message : "Internal server error"
  return c.json({ error: message }, 500)
}
