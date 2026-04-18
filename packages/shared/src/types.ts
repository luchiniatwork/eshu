import type { Generated, Insertable, Selectable, Updateable } from "kysely"

// ---------------------------------------------------------------------------
// Domain types (camelCase, used by application code)
// ---------------------------------------------------------------------------

export interface DirectoryEntry {
  id: string
  projectId: string
  address: string
  displayName: string
  type: "human" | "agent"
  description: string | null
  expectations: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  projectId: string
  threadId: string
  inReplyTo: string | null
  sender: string
  subject: string
  body: string
  type: "message" | "receipt"
  receiptRequested: boolean
  embedding: number[] | null
  createdAt: Date
}

export interface MailboxEntry {
  id: string
  messageId: string
  recipient: string
  readAt: Date | null
  archived: boolean
  createdAt: Date
}

export interface MessageRecipient {
  messageId: string
  recipient: string
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ThreadSummary {
  threadId: string
  subject: string
  lastMessage: {
    id: string
    sender: string
    senderName: string | null
    snippet: string
    createdAt: Date
  }
  unreadCount: number
  totalCount: number
  participants: string[]
}

export interface InboxMessage {
  id: string
  sender: string
  senderName: string | null
  subject: string
  snippet: string
  createdAt: Date
  threadId: string
}

export interface MessageDetail {
  id: string
  threadId: string
  sender: string
  senderName: string | null
  recipients: Array<{ address: string; displayName: string | null }>
  subject: string
  body: string
  type: "message" | "receipt"
  receiptRequested: boolean
  createdAt: Date
  thread?: MessageDetail[]
}

export interface SearchResult {
  id: string
  threadId: string
  sender: string
  senderName: string | null
  subject: string
  snippet: string
  type: "message" | "receipt"
  similarity: number
  createdAt: Date
}

export interface SendResult {
  id: string
  threadId: string
  recipientCount: number
  recipients: string[]
}

export interface ArchiveResult {
  id: string
  archived: boolean
}

export interface Stats {
  messages: {
    total: number
    thisWeek: number
    threads: number
  }
  directory: {
    humans: number
    agents: number
  }
  byParticipant: Array<{
    address: string
    sent: number
    received: number
  }>
  unread: Array<{
    address: string
    count: number
  }>
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ServerConfig {
  projectId: string
  databaseUrl: string
  openaiApiKey: string
  apiPort: number
  apiKey: string | null
  embeddingModel: string
  searchThreshold: number
  searchLimit: number
}

export interface ClientConfig {
  projectId: string
  apiUrl: string
  apiKey: string | null
  agentAddress?: string
  userAddress?: string
}

// ---------------------------------------------------------------------------
// Query option types
// ---------------------------------------------------------------------------

export interface InboxOptions {
  unreadOnly?: boolean
  includeArchived?: boolean
  limit?: number
}

export interface SearchOptions {
  folder?: "inbox" | "sent" | "all"
  limit?: number
  threshold?: number
  includeArchived?: boolean
}

export interface SendMessageInput {
  to: string[]
  subject: string
  body: string
  inReplyTo?: string
  receiptRequested?: boolean
}

// ---------------------------------------------------------------------------
// Kysely table interfaces (snake_case, matching SQL schema)
// ---------------------------------------------------------------------------

export interface DirectoryEntryTable {
  id: Generated<string>
  project_id: string
  address: string
  display_name: string
  type: "human" | "agent"
  description: string | null
  expectations: string | null
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface MessageTable {
  id: Generated<string>
  project_id: string
  thread_id: string
  in_reply_to: string | null
  sender: string
  subject: string
  body: string
  type: Generated<"message" | "receipt">
  receipt_requested: Generated<boolean>
  embedding: string | null
  created_at: Generated<Date>
}

export interface MailboxEntryTable {
  id: Generated<string>
  message_id: string
  recipient: string
  read_at: Date | null
  archived: Generated<boolean>
  created_at: Generated<Date>
}

export interface MessageRecipientTable {
  message_id: string
  recipient: string
}

export interface Database {
  directory_entry: DirectoryEntryTable
  message: MessageTable
  mailbox_entry: MailboxEntryTable
  message_recipient: MessageRecipientTable
}

// ---------------------------------------------------------------------------
// Kysely row type helpers
// ---------------------------------------------------------------------------

export type DirectoryEntryRow = Selectable<DirectoryEntryTable>
export type NewDirectoryEntry = Insertable<DirectoryEntryTable>
export type DirectoryEntryUpdate = Updateable<DirectoryEntryTable>

export type MessageRow = Selectable<MessageTable>
export type NewMessage = Insertable<MessageTable>

export type MailboxEntryRow = Selectable<MailboxEntryTable>
export type NewMailboxEntry = Insertable<MailboxEntryTable>

export type MessageRecipientRow = Selectable<MessageRecipientTable>
export type NewMessageRecipient = Insertable<MessageRecipientTable>
