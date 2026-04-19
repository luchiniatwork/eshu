import {
  embed,
  getMailboxEntry,
  getMessage,
  getThread,
  insertMessage,
  markAsRead,
  toVectorString,
} from "@eshu/shared"
import type { Context } from "hono"
import { ReadMessageSchema } from "../types"
import type { AppEnv } from "../types"
import { resolveDisplayNames } from "./resolve"

/**
 * POST /api/v1/messages/:id/read — Read a message and mark it as read.
 *
 * If the message has `receiptRequested` and this is the first read,
 * a receipt message is auto-created in the same thread.
 */
export async function readMessageHandler(c: Context<AppEnv>) {
  const messageId = c.req.param("id")
  if (!messageId) {
    return c.json({ error: "Message ID is required" }, 400)
  }
  const body = await c.req.json().catch(() => ({}))
  const { includeThread } = ReadMessageSchema.parse(body)

  const db = c.get("db")
  const config = c.get("config")
  const projectId = c.get("projectId")
  const caller = c.get("callerAddress")

  // Fetch message
  const message = await getMessage(db, messageId)
  if (!message) {
    return c.json({ error: `Message not found: "${messageId}"` }, 404)
  }

  // Verify access: caller must have a mailbox entry or be the sender
  const mailbox = await getMailboxEntry(db, messageId, caller)
  const isSender = message.sender === caller

  if (!mailbox && !isSender) {
    return c.json({ error: "Not authorized to read this message" }, 403)
  }

  // Mark as read (if mailbox entry exists and was unread)
  let wasUnread = false
  if (mailbox) {
    const result = await markAsRead(db, messageId, caller)
    wasUnread = result.wasUnread
  }

  // Receipt handling: auto-create receipt on first read
  if (message.receiptRequested && wasUnread && message.type === "message") {
    await createReceipt(db, config, projectId, message, caller)
  }

  // Resolve display names for the message
  const allAddresses = [message.sender, ...message.recipients.map((r) => r.address)]
  const names = await resolveDisplayNames(db, projectId, allAddresses)

  message.senderName = names.get(message.sender) ?? null
  for (const recipient of message.recipients) {
    recipient.displayName = names.get(recipient.address) ?? null
  }

  // Optionally include full thread context
  if (includeThread) {
    const thread = await getThread(db, message.threadId)
    const threadAddresses = thread.flatMap((m) => [m.sender, ...m.recipients.map((r) => r.address)])
    const threadNames = await resolveDisplayNames(db, projectId, threadAddresses)

    for (const msg of thread) {
      msg.senderName = threadNames.get(msg.sender) ?? null
      for (const r of msg.recipients) {
        r.displayName = threadNames.get(r.address) ?? null
      }
    }

    message.thread = thread
  }

  return c.json(message)
}

/**
 * GET /api/v1/messages/:id/thread — Get the full thread for a message.
 */
export async function getThreadHandler(c: Context<AppEnv>) {
  const threadId = c.req.param("id")
  if (!threadId) {
    return c.json({ error: "Thread ID is required" }, 400)
  }

  const db = c.get("db")
  const projectId = c.get("projectId")

  const thread = await getThread(db, threadId)
  if (thread.length === 0) {
    return c.json({ error: `Thread not found: "${threadId}"` }, 404)
  }

  // Resolve display names
  const allAddresses = thread.flatMap((m) => [m.sender, ...m.recipients.map((r) => r.address)])
  const names = await resolveDisplayNames(db, projectId, allAddresses)

  for (const msg of thread) {
    msg.senderName = names.get(msg.sender) ?? null
    for (const r of msg.recipients) {
      r.displayName = names.get(r.address) ?? null
    }
  }

  return c.json(thread)
}

// ---------------------------------------------------------------------------
// Receipt creation helper
// ---------------------------------------------------------------------------

async function createReceipt(
  db: Parameters<typeof insertMessage>[0],
  config: { openaiApiKey: string; embeddingModel: string },
  projectId: string,
  originalMessage: {
    id: string
    threadId: string
    sender: string
    subject: string
  },
  reader: string,
): Promise<void> {
  const receiptSubject = `Read: ${originalMessage.subject.replace(/^Re: /, "")}`
  const receiptBody = [
    `${reader} has read your message.`,
    "",
    `Original subject: ${originalMessage.subject}`,
    `Read at: ${new Date().toISOString()}`,
  ].join("\n")

  // Generate embedding (non-critical — receipt works without it)
  let embeddingStr: string | null = null
  try {
    const vector = await embed(
      `${receiptSubject}\n\n${receiptBody}`,
      config.openaiApiKey,
      config.embeddingModel,
    )
    embeddingStr = toVectorString(vector)
  } catch {
    // Silently skip embedding for receipts
  }

  await insertMessage(db, projectId, {
    sender: reader,
    subject: receiptSubject,
    body: receiptBody,
    threadId: originalMessage.threadId,
    inReplyTo: originalMessage.id,
    type: "receipt",
    receiptRequested: false,
    embedding: embeddingStr,
    recipients: [originalMessage.sender], // Receipt goes to original sender only
  })
}
