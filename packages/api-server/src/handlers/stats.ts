import { getStats } from "@eshu/shared"
import type { Context } from "hono"
import type { AppEnv } from "../types"

/**
 * GET /api/v1/stats — Messaging statistics for the project.
 */
export async function statsHandler(c: Context<AppEnv>) {
  const db = c.get("db")
  const projectId = c.get("projectId")

  const stats = await getStats(db, projectId)
  return c.json(stats)
}
