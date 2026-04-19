import { embed, searchMessages, toVectorString } from "@eshu/shared"
import type { Context } from "hono"
import { SearchSchema } from "../types"
import type { AppEnv } from "../types"
import { resolveDisplayNames } from "./resolve"

/**
 * POST /api/v1/messages/search — Semantic search within the caller's mailbox.
 *
 * Generates an embedding for the query and uses pgvector similarity
 * search to find relevant messages.
 */
export async function searchHandler(c: Context<AppEnv>) {
  const body = await c.req.json()
  const { query, folder, limit, includeArchived } = SearchSchema.parse(body)

  const db = c.get("db")
  const config = c.get("config")
  const projectId = c.get("projectId")
  const recipient = c.get("callerAddress")

  // Generate embedding for the search query
  const vector = await embed(query, config.openaiApiKey, config.embeddingModel)
  const embeddingStr = toVectorString(vector)

  const results = await searchMessages(db, projectId, recipient, embeddingStr, {
    folder,
    limit,
    threshold: config.searchThreshold,
    includeArchived,
  })

  // Resolve sender display names
  const senderAddresses = results.map((r) => r.sender)
  const names = await resolveDisplayNames(db, projectId, senderAddresses)

  for (const result of results) {
    result.senderName = names.get(result.sender) ?? null
  }

  return c.json(results)
}
