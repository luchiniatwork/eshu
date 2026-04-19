import { getMailboxEntry, setArchived } from "@eshu/shared"
import type { Context } from "hono"
import type { AppEnv } from "../types"

/**
 * POST /api/v1/messages/:id/archive — Archive a message in the caller's mailbox.
 */
export async function archiveHandler(c: Context<AppEnv>) {
  return setArchivedState(c, true)
}

/**
 * POST /api/v1/messages/:id/unarchive — Unarchive a message in the caller's mailbox.
 */
export async function unarchiveHandler(c: Context<AppEnv>) {
  return setArchivedState(c, false)
}

async function setArchivedState(c: Context<AppEnv>, archived: boolean) {
  const messageId = c.req.param("id")
  if (!messageId) {
    return c.json({ error: "Message ID is required" }, 400)
  }

  const db = c.get("db")
  const caller = c.get("callerAddress")

  // Verify the caller has a mailbox entry for this message
  const mailbox = await getMailboxEntry(db, messageId, caller)
  if (!mailbox) {
    return c.json({ error: `Message not in your mailbox: "${messageId}"` }, 404)
  }

  await setArchived(db, messageId, caller, archived)

  return c.json({ id: messageId, archived })
}
