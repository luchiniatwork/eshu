import type {
  ArchiveResult,
  DirectoryEntry,
  InboxMessage,
  MessageDetail,
  SearchResult,
  SendResult,
  Stats,
  ThreadSummary,
} from "@eshu/shared"
import { ApiError } from "./errors"
import type { ClientOptions } from "./types"

/**
 * Create a typed HTTP client for the Eshu REST API.
 *
 * All methods set the `X-Eshu-Address` header from the configured address
 * and include the API key (if provided) as a Bearer token.
 */
export function createClient(opts: ClientOptions) {
  const { apiKey, address } = opts
  // Normalize: strip trailing slashes from the base URL
  const baseUrl = opts.apiUrl.replace(/\/+$/, "")

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Eshu-Address": address,
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    const url = `${baseUrl}${path}`
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: response.statusText }))
      throw new ApiError(
        (errorBody as { error?: string }).error ?? response.statusText,
        response.status,
        (errorBody as { details?: unknown }).details,
      )
    }

    return response.json() as Promise<T>
  }

  return {
    // -----------------------------------------------------------------------
    // Health
    // -----------------------------------------------------------------------

    /** Check API server health. No auth or identity required. */
    health(): Promise<{ status: string; projectId: string; timestamp: string }> {
      return request("GET", "/api/v1/health")
    },

    // -----------------------------------------------------------------------
    // Directory
    // -----------------------------------------------------------------------

    /** List directory entries with optional type filter. */
    directory(type?: "human" | "agent"): Promise<DirectoryEntry[]> {
      return request("POST", "/api/v1/directory", type ? { type } : {})
    },

    /** Add a new directory entry. */
    addDirectoryEntry(entry: {
      address: string
      displayName: string
      type: "human" | "agent"
      description?: string | null
      expectations?: string | null
    }): Promise<DirectoryEntry> {
      return request("POST", "/api/v1/directory/add", entry)
    },

    /** Update an existing directory entry. */
    updateDirectoryEntry(
      address: string,
      updates: {
        displayName?: string
        description?: string | null
        expectations?: string | null
      },
    ): Promise<DirectoryEntry> {
      const encoded = encodeURIComponent(address)
      return request("PUT", `/api/v1/directory/${encoded}`, updates)
    },

    /** Remove a directory entry. */
    removeDirectoryEntry(address: string): Promise<{ success: boolean }> {
      const encoded = encodeURIComponent(address)
      return request("DELETE", `/api/v1/directory/${encoded}`)
    },

    // -----------------------------------------------------------------------
    // Inbox
    // -----------------------------------------------------------------------

    /** Get inbox in threaded mode (thread summaries). */
    inboxThreaded(opts?: {
      unreadOnly?: boolean
      limit?: number
      includeArchived?: boolean
    }): Promise<ThreadSummary[]> {
      return request("POST", "/api/v1/inbox", { ...opts, mode: "threaded" })
    },

    /** Get inbox in flat mode (individual messages). */
    inboxFlat(opts?: {
      unreadOnly?: boolean
      limit?: number
      includeArchived?: boolean
    }): Promise<InboxMessage[]> {
      return request("POST", "/api/v1/inbox", { ...opts, mode: "flat" })
    },

    // -----------------------------------------------------------------------
    // Messages
    // -----------------------------------------------------------------------

    /** Read a message and mark it as read. Optionally include full thread. */
    readMessage(id: string, opts?: { includeThread?: boolean }): Promise<MessageDetail> {
      return request("POST", `/api/v1/messages/${id}/read`, opts ?? {})
    },

    /** Get the full thread for a message ID (the ID is the thread root). */
    getThread(id: string): Promise<MessageDetail[]> {
      return request("GET", `/api/v1/messages/${id}/thread`)
    },

    /** Search messages by natural-language query (semantic search). */
    searchMessages(
      query: string,
      opts?: {
        folder?: "inbox" | "sent" | "all"
        limit?: number
        includeArchived?: boolean
      },
    ): Promise<SearchResult[]> {
      return request("POST", "/api/v1/messages/search", { query, ...opts })
    },

    /** Send a new message or reply to an existing thread. */
    sendMessage(input: {
      to?: string[]
      subject?: string
      body: string
      inReplyTo?: string
      receiptRequested?: boolean
    }): Promise<SendResult> {
      return request("POST", "/api/v1/messages/send", input)
    },

    /** Archive a message (hides from inbox, still searchable). */
    archiveMessage(id: string): Promise<ArchiveResult> {
      return request("POST", `/api/v1/messages/${id}/archive`)
    },

    /** Unarchive a message (restores to inbox). */
    unarchiveMessage(id: string): Promise<ArchiveResult> {
      return request("POST", `/api/v1/messages/${id}/unarchive`)
    },

    // -----------------------------------------------------------------------
    // Stats
    // -----------------------------------------------------------------------

    /** Get project messaging statistics. */
    stats(): Promise<Stats> {
      return request("GET", "/api/v1/stats")
    },
  }
}

/** The client instance type returned by `createClient()`. */
export type EshuClient = ReturnType<typeof createClient>
