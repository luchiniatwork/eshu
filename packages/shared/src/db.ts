import { randomUUID } from "node:crypto"
import { Kysely, sql } from "kysely"
import { PostgresJSDialect } from "kysely-postgres-js"
import postgres from "postgres"
import type {
  Database,
  DirectoryEntry,
  DirectoryEntryRow,
  InboxMessage,
  InboxOptions,
  MailboxEntryRow,
  MessageDetail,
  NewMailboxEntry,
  NewMessage,
  NewMessageRecipient,
  SearchResult,
  Stats,
  ThreadSummary,
} from "./types"

// ---------------------------------------------------------------------------
// Database factory
// ---------------------------------------------------------------------------

export function createDb(databaseUrl: string): Kysely<Database> {
  const pg = postgres(databaseUrl)
  return new Kysely<Database>({
    dialect: new PostgresJSDialect({ postgres: pg }),
  })
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

export async function listDirectory(
  db: Kysely<Database>,
  projectId: string,
  typeFilter?: "human" | "agent",
): Promise<DirectoryEntry[]> {
  let query = db
    .selectFrom("directory_entry")
    .selectAll()
    .where("project_id", "=", projectId)
    .orderBy("address")

  if (typeFilter) {
    query = query.where("type", "=", typeFilter)
  }

  const rows = await query.execute()
  return rows.map(toDirectoryEntry)
}

export async function getDirectoryEntry(
  db: Kysely<Database>,
  projectId: string,
  address: string,
): Promise<DirectoryEntry | null> {
  const row = await db
    .selectFrom("directory_entry")
    .selectAll()
    .where("project_id", "=", projectId)
    .where("address", "=", address)
    .executeTakeFirst()

  return row ? toDirectoryEntry(row) : null
}

export async function addDirectoryEntry(
  db: Kysely<Database>,
  projectId: string,
  entry: {
    address: string
    displayName: string
    type: "human" | "agent"
    description?: string | null
    expectations?: string | null
  },
): Promise<DirectoryEntry> {
  const row = await db
    .insertInto("directory_entry")
    .values({
      project_id: projectId,
      address: entry.address,
      display_name: entry.displayName,
      type: entry.type,
      description: entry.description ?? null,
      expectations: entry.expectations ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return toDirectoryEntry(row)
}

export async function updateDirectoryEntry(
  db: Kysely<Database>,
  projectId: string,
  address: string,
  updates: {
    displayName?: string
    description?: string | null
    expectations?: string | null
  },
): Promise<DirectoryEntry | null> {
  const values: Record<string, unknown> = { updated_at: new Date() }
  if (updates.displayName !== undefined) values.display_name = updates.displayName
  if (updates.description !== undefined) values.description = updates.description
  if (updates.expectations !== undefined) values.expectations = updates.expectations

  const row = await db
    .updateTable("directory_entry")
    .set(values)
    .where("project_id", "=", projectId)
    .where("address", "=", address)
    .returningAll()
    .executeTakeFirst()

  return row ? toDirectoryEntry(row) : null
}

export async function removeDirectoryEntry(
  db: Kysely<Database>,
  projectId: string,
  address: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom("directory_entry")
    .where("project_id", "=", projectId)
    .where("address", "=", address)
    .executeTakeFirst()

  return result.numDeletedRows > 0n
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export async function getInboxThreaded(
  db: Kysely<Database>,
  projectId: string,
  recipient: string,
  opts: InboxOptions = {},
): Promise<ThreadSummary[]> {
  const { unreadOnly = true, includeArchived = false, limit = 20 } = opts

  // Step 1: Get mailbox entries for this recipient
  let mailboxQuery = db
    .selectFrom("mailbox_entry")
    .innerJoin("message", "message.id", "mailbox_entry.message_id")
    .select([
      "message.thread_id",
      "message.id as message_id",
      "message.sender",
      "message.subject",
      "message.body",
      "message.created_at",
      "mailbox_entry.read_at",
    ])
    .where("mailbox_entry.recipient", "=", recipient)
    .where("message.project_id", "=", projectId)

  if (!includeArchived) {
    mailboxQuery = mailboxQuery.where("mailbox_entry.archived", "=", false)
  }
  if (unreadOnly) {
    mailboxQuery = mailboxQuery.where("mailbox_entry.read_at", "is", null)
  }

  const entries = await mailboxQuery.orderBy("message.created_at", "desc").execute()

  // Step 2: Group by thread_id
  const threadMap = new Map<
    string,
    {
      messages: Array<{
        id: string
        sender: string
        subject: string
        body: string
        createdAt: Date
        isUnread: boolean
      }>
    }
  >()

  for (const entry of entries) {
    const threadId = entry.thread_id
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, { messages: [] })
    }
    threadMap.get(threadId)!.messages.push({
      id: entry.message_id,
      sender: entry.sender,
      subject: entry.subject,
      body: entry.body,
      createdAt: entry.created_at,
      isUnread: entry.read_at === null,
    })
  }

  // Step 3: Build thread summaries
  const summaries: ThreadSummary[] = []

  for (const [threadId, thread] of threadMap) {
    // Get full thread info for participant list and total count
    const threadMessages = await db
      .selectFrom("message")
      .select(["id", "sender", "subject", "created_at"])
      .where("thread_id", "=", threadId)
      .orderBy("created_at")
      .execute()

    const participants = [...new Set(threadMessages.map((m) => m.sender))]
    const lastMsg = thread.messages[0] // Already sorted desc
    const rootSubject = threadMessages[0]?.subject ?? lastMsg.subject

    summaries.push({
      threadId,
      subject: rootSubject,
      lastMessage: {
        id: lastMsg.id,
        sender: lastMsg.sender,
        senderName: null, // Resolved by API layer with directory lookup
        snippet: lastMsg.body.slice(0, 200),
        createdAt: lastMsg.createdAt,
      },
      unreadCount: thread.messages.filter((m) => m.isUnread).length,
      totalCount: threadMessages.length,
      participants,
    })
  }

  // Sort by last message date, most recent first
  summaries.sort((a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime())

  return summaries.slice(0, limit)
}

export async function getInboxFlat(
  db: Kysely<Database>,
  projectId: string,
  recipient: string,
  opts: InboxOptions = {},
): Promise<InboxMessage[]> {
  const { unreadOnly = true, includeArchived = false, limit = 20 } = opts

  let query = db
    .selectFrom("mailbox_entry")
    .innerJoin("message", "message.id", "mailbox_entry.message_id")
    .select([
      "message.id",
      "message.sender",
      "message.subject",
      "message.body",
      "message.created_at",
      "message.thread_id",
    ])
    .where("mailbox_entry.recipient", "=", recipient)
    .where("message.project_id", "=", projectId)

  if (!includeArchived) {
    query = query.where("mailbox_entry.archived", "=", false)
  }
  if (unreadOnly) {
    query = query.where("mailbox_entry.read_at", "is", null)
  }

  const rows = await query.orderBy("message.created_at", "desc").limit(limit).execute()

  return rows.map((row) => ({
    id: row.id,
    sender: row.sender,
    senderName: null, // Resolved by API layer
    subject: row.subject,
    snippet: row.body.slice(0, 200),
    createdAt: row.created_at,
    threadId: row.thread_id,
  }))
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function insertMessage(
  db: Kysely<Database>,
  projectId: string,
  msg: {
    sender: string
    subject: string
    body: string
    threadId?: string
    inReplyTo?: string
    type?: "message" | "receipt"
    receiptRequested?: boolean
    embedding?: string | null
    recipients: string[]
  },
): Promise<{ id: string; threadId: string }> {
  return db.transaction().execute(async (trx) => {
    // For new threads, pre-generate the message ID so thread_id = id
    const messageId = randomUUID()
    const threadId = msg.threadId ?? messageId

    const messageValues: NewMessage = {
      id: messageId,
      project_id: projectId,
      sender: msg.sender,
      subject: msg.subject,
      body: msg.body,
      thread_id: threadId,
      in_reply_to: msg.inReplyTo ?? null,
      type: msg.type ?? "message",
      receipt_requested: msg.receiptRequested ?? false,
      embedding: msg.embedding ?? null,
    }

    await trx.insertInto("message").values(messageValues).execute()

    // Insert message recipients
    if (msg.recipients.length > 0) {
      const recipientValues: NewMessageRecipient[] = msg.recipients.map((r) => ({
        message_id: messageId,
        recipient: r,
      }))
      await trx.insertInto("message_recipient").values(recipientValues).execute()
    }

    // Create mailbox entries for each recipient
    if (msg.recipients.length > 0) {
      const mailboxValues: NewMailboxEntry[] = msg.recipients.map((r) => ({
        message_id: messageId,
        recipient: r,
        read_at: null,
      }))
      await trx.insertInto("mailbox_entry").values(mailboxValues).execute()
    }

    return { id: messageId, threadId }
  })
}

export async function getMessage(
  db: Kysely<Database>,
  messageId: string,
): Promise<MessageDetail | null> {
  const row = await db
    .selectFrom("message")
    .selectAll()
    .where("id", "=", messageId)
    .executeTakeFirst()

  if (!row) return null

  // Get recipients
  const recipients = await db
    .selectFrom("message_recipient")
    .select("recipient")
    .where("message_id", "=", messageId)
    .execute()

  return {
    id: row.id,
    threadId: row.thread_id,
    sender: row.sender,
    senderName: null, // Resolved by API layer
    recipients: recipients.map((r) => ({ address: r.recipient, displayName: null })),
    subject: row.subject,
    body: row.body,
    type: row.type as "message" | "receipt",
    receiptRequested: row.receipt_requested,
    createdAt: row.created_at,
  }
}

export async function getThread(
  db: Kysely<Database>,
  threadId: string,
): Promise<MessageDetail[]> {
  const rows = await db
    .selectFrom("message")
    .selectAll()
    .where("thread_id", "=", threadId)
    .orderBy("created_at")
    .execute()

  const details: MessageDetail[] = []

  for (const row of rows) {
    const recipients = await db
      .selectFrom("message_recipient")
      .select("recipient")
      .where("message_id", "=", row.id)
      .execute()

    details.push({
      id: row.id,
      threadId: row.thread_id,
      sender: row.sender,
      senderName: null,
      recipients: recipients.map((r) => ({ address: r.recipient, displayName: null })),
      subject: row.subject,
      body: row.body,
      type: row.type as "message" | "receipt",
      receiptRequested: row.receipt_requested,
      createdAt: row.created_at,
    })
  }

  return details
}

export async function getMailboxEntry(
  db: Kysely<Database>,
  messageId: string,
  recipient: string,
): Promise<MailboxEntryRow | null> {
  return (
    (await db
      .selectFrom("mailbox_entry")
      .selectAll()
      .where("message_id", "=", messageId)
      .where("recipient", "=", recipient)
      .executeTakeFirst()) ?? null
  )
}

export async function markAsRead(
  db: Kysely<Database>,
  messageId: string,
  recipient: string,
): Promise<{ wasUnread: boolean }> {
  const entry = await getMailboxEntry(db, messageId, recipient)
  if (!entry) {
    return { wasUnread: false }
  }

  const wasUnread = entry.read_at === null

  if (wasUnread) {
    await db
      .updateTable("mailbox_entry")
      .set({ read_at: new Date() })
      .where("message_id", "=", messageId)
      .where("recipient", "=", recipient)
      .execute()
  }

  return { wasUnread }
}

export async function getSentMessages(
  db: Kysely<Database>,
  projectId: string,
  sender: string,
  opts: { limit?: number } = {},
): Promise<InboxMessage[]> {
  const { limit = 20 } = opts

  const rows = await db
    .selectFrom("message")
    .select(["id", "sender", "subject", "body", "created_at", "thread_id"])
    .where("project_id", "=", projectId)
    .where("sender", "=", sender)
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute()

  return rows.map((row) => ({
    id: row.id,
    sender: row.sender,
    senderName: null,
    subject: row.subject,
    snippet: row.body.slice(0, 200),
    createdAt: row.created_at,
    threadId: row.thread_id,
  }))
}

/**
 * Get all recipients of a message. Used for reply-all resolution.
 */
export async function getMessageRecipients(
  db: Kysely<Database>,
  messageId: string,
): Promise<string[]> {
  const rows = await db
    .selectFrom("message_recipient")
    .select("recipient")
    .where("message_id", "=", messageId)
    .execute()

  return rows.map((r) => r.recipient)
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchMessages(
  db: Kysely<Database>,
  projectId: string,
  recipient: string,
  embedding: string,
  opts: {
    folder?: "inbox" | "sent" | "all"
    limit?: number
    threshold?: number
    includeArchived?: boolean
  } = {},
): Promise<SearchResult[]> {
  const {
    folder = "inbox",
    limit = 20,
    threshold = 0.25,
    includeArchived = false,
  } = opts

  const result = await sql<{
    id: string
    thread_id: string
    sender: string
    subject: string
    body: string
    type: string
    similarity: number
    created_at: Date
  }>`
    SELECT * FROM search_messages(
      ${projectId},
      ${recipient},
      ${embedding}::vector,
      ${limit},
      ${threshold},
      ${folder},
      ${includeArchived}
    )
  `.execute(db)

  return result.rows.map((row) => ({
    id: row.id,
    threadId: row.thread_id,
    sender: row.sender,
    senderName: null, // Resolved by API layer
    subject: row.subject,
    snippet: row.body.slice(0, 200),
    type: row.type as "message" | "receipt",
    similarity: row.similarity,
    createdAt: row.created_at,
  }))
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

export async function setArchived(
  db: Kysely<Database>,
  messageId: string,
  recipient: string,
  archived: boolean,
): Promise<boolean> {
  const result = await db
    .updateTable("mailbox_entry")
    .set({ archived })
    .where("message_id", "=", messageId)
    .where("recipient", "=", recipient)
    .executeTakeFirst()

  return result.numUpdatedRows > 0n
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getStats(
  db: Kysely<Database>,
  projectId: string,
): Promise<Stats> {
  // Total messages
  const totalResult = await db
    .selectFrom("message")
    .select(db.fn.count("id").as("count"))
    .where("project_id", "=", projectId)
    .executeTakeFirstOrThrow()

  // This week
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const weekResult = await db
    .selectFrom("message")
    .select(db.fn.count("id").as("count"))
    .where("project_id", "=", projectId)
    .where("created_at", ">=", weekAgo)
    .executeTakeFirstOrThrow()

  // Thread count
  const threadResult = await db
    .selectFrom("message")
    .select(db.fn.count(sql`DISTINCT thread_id`).as("count"))
    .where("project_id", "=", projectId)
    .executeTakeFirstOrThrow()

  // Directory counts
  const directoryResult = await db
    .selectFrom("directory_entry")
    .select(["type", db.fn.count("id").as("count")])
    .where("project_id", "=", projectId)
    .groupBy("type")
    .execute()

  const humans = Number(directoryResult.find((r) => r.type === "human")?.count ?? 0)
  const agents = Number(directoryResult.find((r) => r.type === "agent")?.count ?? 0)

  // By participant (last 7 days)
  const sentByParticipant = await db
    .selectFrom("message")
    .select(["sender", db.fn.count("id").as("count")])
    .where("project_id", "=", projectId)
    .where("created_at", ">=", weekAgo)
    .groupBy("sender")
    .execute()

  const receivedByParticipant = await db
    .selectFrom("mailbox_entry")
    .innerJoin("message", "message.id", "mailbox_entry.message_id")
    .select(["mailbox_entry.recipient", db.fn.count("mailbox_entry.id").as("count")])
    .where("message.project_id", "=", projectId)
    .where("mailbox_entry.created_at", ">=", weekAgo)
    .groupBy("mailbox_entry.recipient")
    .execute()

  const participantMap = new Map<string, { sent: number; received: number }>()
  for (const row of sentByParticipant) {
    participantMap.set(row.sender, {
      sent: Number(row.count),
      received: participantMap.get(row.sender)?.received ?? 0,
    })
  }
  for (const row of receivedByParticipant) {
    const existing = participantMap.get(row.recipient) ?? { sent: 0, received: 0 }
    participantMap.set(row.recipient, {
      ...existing,
      received: Number(row.count),
    })
  }

  // Unread counts
  const unreadResult = await db
    .selectFrom("mailbox_entry")
    .select(["recipient", db.fn.count("id").as("count")])
    .where("read_at", "is", null)
    .where("archived", "=", false)
    .groupBy("recipient")
    .execute()

  return {
    messages: {
      total: Number(totalResult.count),
      thisWeek: Number(weekResult.count),
      threads: Number(threadResult.count),
    },
    directory: {
      humans,
      agents,
    },
    byParticipant: [...participantMap.entries()]
      .map(([address, counts]) => ({
        address,
        ...counts,
      }))
      .sort((a, b) => b.sent + b.received - (a.sent + a.received)),
    unread: unreadResult.map((r) => ({
      address: r.recipient,
      count: Number(r.count),
    })),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDirectoryEntry(row: DirectoryEntryRow): DirectoryEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    address: row.address,
    displayName: row.display_name,
    type: row.type,
    description: row.description,
    expectations: row.expectations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
