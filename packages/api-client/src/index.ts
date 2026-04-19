export { createClient } from "./client"
export type { EshuClient } from "./client"
export { ApiError } from "./errors"
export type { ClientOptions } from "./types"

// Re-export response types so consumers don't need @eshu/shared directly
export type {
  ArchiveResult,
  DirectoryEntry,
  InboxMessage,
  MessageDetail,
  SearchResult,
  SendResult,
  Stats,
  ThreadSummary,
} from "@eshu/shared"
