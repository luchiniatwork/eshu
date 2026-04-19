import {
  embed,
  getDirectoryEntry,
  getMessage,
  getMessageRecipients,
  insertMessage,
  toVectorString,
  validateAddress,
} from "@eshu/shared"
import type { Context } from "hono"
import { SendMessageSchema } from "../types"
import type { AppEnv } from "../types"

/**
 * POST /api/v1/messages/send — Send a new message or reply to an existing thread.
 *
 * New message: requires `to` and `subject`.
 * Reply: set `inReplyTo` to auto-inherit thread, recipients, and subject.
 */
export async function sendMessageHandler(c: Context<AppEnv>) {
  const body = await c.req.json()
  const input = SendMessageSchema.parse(body)

  const db = c.get("db")
  const config = c.get("config")
  const projectId = c.get("projectId")
  const sender = c.get("callerAddress")

  // Validate sender is registered in the directory
  const senderEntry = await getDirectoryEntry(db, projectId, sender)
  if (!senderEntry) {
    return c.json({ error: `Sender not registered in directory: "${sender}"` }, 403)
  }

  let to: string[]
  let subject: string
  let threadId: string | undefined
  let inReplyTo: string | undefined

  if (input.inReplyTo) {
    // -----------------------------------------------------------------------
    // Reply flow
    // -----------------------------------------------------------------------
    const parent = await getMessage(db, input.inReplyTo)
    if (!parent) {
      return c.json({ error: `Message not found: "${input.inReplyTo}"` }, 404)
    }

    inReplyTo = input.inReplyTo
    threadId = parent.threadId

    // Resolve recipients: explicit `to` or reply-all
    if (input.to) {
      to = input.to
    } else {
      const parentRecipients = await getMessageRecipients(db, input.inReplyTo)
      const allParties = new Set([...parentRecipients, parent.sender])
      allParties.delete(sender)
      to = [...allParties]
    }

    // Resolve subject: explicit or "Re: <root subject>"
    if (input.subject) {
      subject = input.subject
    } else {
      // Fetch root message to avoid Re: Re: Re: stacking
      const rootMessage = await getMessage(db, threadId)
      const rootSubject = rootMessage?.subject ?? parent.subject
      subject = rootSubject.startsWith("Re: ") ? rootSubject : `Re: ${rootSubject}`
    }
  } else {
    // -----------------------------------------------------------------------
    // New message flow
    // -----------------------------------------------------------------------
    if (!input.to || input.to.length === 0) {
      return c.json({ error: "Recipients (to) are required for new messages" }, 400)
    }
    if (!input.subject) {
      return c.json({ error: "Subject is required for new messages" }, 400)
    }
    to = input.to
    subject = input.subject
  }

  // Validate all recipient addresses
  for (const addr of to) {
    validateAddress(addr)
    const entry = await getDirectoryEntry(db, projectId, addr)
    if (!entry) {
      return c.json({ error: `Unknown recipient: "${addr}"` }, 400)
    }
  }

  // Generate embedding (non-blocking failure — message still saved)
  let embeddingStr: string | null = null
  try {
    const vector = await embed(
      `${subject}\n\n${input.body}`,
      config.openaiApiKey,
      config.embeddingModel,
    )
    embeddingStr = toVectorString(vector)
  } catch (err) {
    console.error("Failed to generate embedding:", err)
  }

  // Insert message (transactional: message + recipients + mailbox entries)
  const result = await insertMessage(db, projectId, {
    sender,
    subject,
    body: input.body,
    threadId,
    inReplyTo,
    receiptRequested: input.receiptRequested,
    embedding: embeddingStr,
    recipients: to,
  })

  return c.json(
    {
      id: result.id,
      threadId: result.threadId,
      recipientCount: to.length,
      recipients: to,
    },
    201,
  )
}
