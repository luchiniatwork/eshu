import { getInboxFlat, getInboxThreaded } from "@eshu/shared"
import type { Context } from "hono"
import { InboxSchema } from "../types"
import type { AppEnv } from "../types"
import { resolveDisplayNames } from "./resolve"

/**
 * POST /api/v1/inbox — Get the caller's inbox.
 *
 * Supports threaded mode (grouped by thread with summaries) and
 * flat mode (individual messages chronologically).
 */
export async function inboxHandler(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => ({}))
  const { unreadOnly, mode, limit, includeArchived } = InboxSchema.parse(body)

  const db = c.get("db")
  const projectId = c.get("projectId")
  const recipient = c.get("callerAddress")

  const opts = { unreadOnly, includeArchived, limit }

  if (mode === "threaded") {
    const threads = await getInboxThreaded(db, projectId, recipient, opts)

    // Resolve sender display names
    const senderAddresses = threads.map((t) => t.lastMessage.sender)
    const names = await resolveDisplayNames(db, projectId, senderAddresses)

    for (const thread of threads) {
      thread.lastMessage.senderName = names.get(thread.lastMessage.sender) ?? null
    }

    return c.json(threads)
  }

  // Flat mode
  const messages = await getInboxFlat(db, projectId, recipient, opts)

  const senderAddresses = messages.map((m) => m.sender)
  const names = await resolveDisplayNames(db, projectId, senderAddresses)

  for (const msg of messages) {
    msg.senderName = names.get(msg.sender) ?? null
  }

  return c.json(messages)
}
