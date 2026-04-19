import type { Database, ServerConfig } from "@eshu/shared"
import { Hono } from "hono"
import type { Kysely } from "kysely"
import { archiveHandler, unarchiveHandler } from "./handlers/archive"
import {
  addDirectoryHandler,
  listDirectoryHandler,
  removeDirectoryHandler,
  updateDirectoryHandler,
} from "./handlers/directory"
import { inboxHandler } from "./handlers/inbox"
import { getThreadHandler, readMessageHandler } from "./handlers/read"
import { searchHandler } from "./handlers/search"
import { sendMessageHandler } from "./handlers/send"
import { statsHandler } from "./handlers/stats"
import { authMiddleware } from "./middleware/auth"
import { handleError } from "./middleware/error-handler"
import { identityMiddleware } from "./middleware/identity"
import type { AppEnv } from "./types"

/**
 * Create the Hono application with all middleware and routes.
 *
 * @param config - Server configuration (project ID, API key, embedding settings)
 * @param db - Kysely database instance
 * @returns Configured Hono app ready to serve requests
 */
export function createApp(config: ServerConfig, db: Kysely<Database>): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  // Global error handler
  app.onError(handleError)

  // Inject db, config, projectId on all requests
  app.use("*", async (c, next) => {
    c.set("db", db)
    c.set("config", config)
    c.set("projectId", config.projectId)
    return next()
  })

  // Health check — no auth or identity required
  app.get("/api/v1/health", (c) =>
    c.json({
      status: "ok",
      projectId: config.projectId,
      timestamp: new Date().toISOString(),
    }),
  )

  // -------------------------------------------------------------------------
  // Authenticated routes — require valid API key + caller identity
  // -------------------------------------------------------------------------

  const api = new Hono<AppEnv>()
  api.use("*", authMiddleware())
  api.use("*", identityMiddleware())

  // Directory
  api.post("/directory", listDirectoryHandler)
  api.post("/directory/add", addDirectoryHandler)
  api.put("/directory/:address", updateDirectoryHandler)
  api.delete("/directory/:address", removeDirectoryHandler)

  // Inbox
  api.post("/inbox", inboxHandler)

  // Messages
  api.post("/messages/send", sendMessageHandler)
  api.post("/messages/search", searchHandler)
  api.post("/messages/:id/read", readMessageHandler)
  api.post("/messages/:id/archive", archiveHandler)
  api.post("/messages/:id/unarchive", unarchiveHandler)
  api.get("/messages/:id/thread", getThreadHandler)

  // Stats
  api.get("/stats", statsHandler)

  app.route("/api/v1", api)

  return app
}
