import { getMailboxEntry, markAsUnread } from "@eshu/shared"
import type { Context } from "hono"
import type { AppEnv } from "../types"

/**
 * POST /api/v1/messages/:id/unread — Mark a message as unread in the caller's mailbox.
 */
export async function markUnreadHandler(c: Context<AppEnv>) {
  const messageId = c.req.param("id")
  if (!messageId) {
    return c.json({ error: "Message ID is required" }, 400)
  }

  const db = c.get("db")
  const caller = c.get("callerAddress")

  const mailbox = await getMailboxEntry(db, messageId, caller)
  if (!mailbox) {
    return c.json({ error: `Message not in your mailbox: "${messageId}"` }, 404)
  }

  const updated = await markAsUnread(db, messageId, caller)

  return c.json({ id: messageId, markedUnread: updated })
}
