import type { EshuClient } from "@eshu/api-client"
import type {
  DirectoryEntry,
  InboxMessage,
  MessageDetail,
  SearchResult,
  ThreadSummary,
} from "@eshu/shared"
import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"

// ---------------------------------------------------------------------------
// App mode
// ---------------------------------------------------------------------------

export type AppMode = "inbox" | "sent" | "search" | "directory"

// ---------------------------------------------------------------------------
// Overlay state
// ---------------------------------------------------------------------------

export type Overlay = "none" | "help" | "compose" | "reply" | "quickReply"

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

export interface AppState {
  mode: AppMode
  setMode: (mode: AppMode) => void

  overlay: Overlay
  setOverlay: (overlay: Overlay) => void

  // Inbox
  threads: ThreadSummary[]
  setThreads: (threads: ThreadSummary[]) => void
  flatMessages: InboxMessage[]
  setFlatMessages: (messages: InboxMessage[]) => void
  threaded: boolean
  setThreaded: (threaded: boolean) => void

  // Sent
  sentMessages: InboxMessage[]
  setSentMessages: (messages: InboxMessage[]) => void

  // Selected item
  selectedIndex: number
  setSelectedIndex: (index: number) => void

  // Active message detail
  activeMessage: MessageDetail | null
  setActiveMessage: (message: MessageDetail | null) => void

  // Thread expansion
  expandedThread: MessageDetail[] | null
  setExpandedThread: (thread: MessageDetail[] | null) => void

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: SearchResult[]
  setSearchResults: (results: SearchResult[]) => void
  searchActive: boolean
  setSearchActive: (active: boolean) => void

  // Directory
  directoryEntries: DirectoryEntry[]
  setDirectoryEntries: (entries: DirectoryEntry[]) => void

  // Status
  unreadCount: number
  setUnreadCount: (count: number) => void
  loading: boolean
  setLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
  statusMessage: string | null
  setStatusMessage: (msg: string | null) => void

  // Reply context
  replyTo: MessageDetail | null
  setReplyTo: (message: MessageDetail | null) => void
}

const AppStateContext = createContext<AppState | null>(null)

// ---------------------------------------------------------------------------
// Client context
// ---------------------------------------------------------------------------

interface ClientContextValue {
  client: EshuClient
  userAddress: string
  projectId: string
}

const ClientContext = createContext<ClientContextValue | null>(null)

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error("useAppState must be used within AppProvider")
  return ctx
}

export function useClient(): ClientContextValue {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error("useClient must be used within AppProvider")
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AppProviderProps {
  client: EshuClient
  userAddress: string
  projectId: string
  children: ReactNode
}

export function AppProvider({ client, userAddress, projectId, children }: AppProviderProps) {
  const [mode, setMode] = useState<AppMode>("inbox")
  const [overlay, setOverlay] = useState<Overlay>("none")
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [flatMessages, setFlatMessages] = useState<InboxMessage[]>([])
  const [threaded, setThreaded] = useState(true)
  const [sentMessages, setSentMessages] = useState<InboxMessage[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeMessage, setActiveMessage] = useState<MessageDetail | null>(null)
  const [expandedThread, setExpandedThread] = useState<MessageDetail[] | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchActive, setSearchActive] = useState(false)
  const [directoryEntries, setDirectoryEntries] = useState<DirectoryEntry[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<MessageDetail | null>(null)

  const state: AppState = {
    mode,
    setMode,
    overlay,
    setOverlay,
    threads,
    setThreads,
    flatMessages,
    setFlatMessages,
    threaded,
    setThreaded,
    sentMessages,
    setSentMessages,
    selectedIndex,
    setSelectedIndex,
    activeMessage,
    setActiveMessage,
    expandedThread,
    setExpandedThread,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchActive,
    setSearchActive,
    directoryEntries,
    setDirectoryEntries,
    unreadCount,
    setUnreadCount,
    loading,
    setLoading,
    error,
    setError,
    statusMessage,
    setStatusMessage,
    replyTo,
    setReplyTo,
  }

  return (
    <ClientContext.Provider value={{ client, userAddress, projectId }}>
      <AppStateContext.Provider value={state}>{children}</AppStateContext.Provider>
    </ClientContext.Provider>
  )
}
