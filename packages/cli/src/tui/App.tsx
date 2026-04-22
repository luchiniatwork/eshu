import type { EshuClient } from "@eshu/api-client"
import { Box, Text, useApp, useInput } from "ink"
import { useCallback, useEffect } from "react"
import { editInEditor, parseTemplate } from "../editor"
import { DirectoryDetail, DirectoryList } from "./components/DirectoryView"
import { Footer } from "./components/Footer"
import { Header } from "./components/Header"
import { HelpOverlay } from "./components/HelpOverlay"
import { MessageDetail } from "./components/MessageDetail"
import { ThreadView } from "./components/MessageDetail"
import { FlatList, SearchList, ThreadList } from "./components/MessageList"
import { QuickReply } from "./components/QuickReply"
import { SearchBar } from "./components/SearchBar"
import { AppProvider, useAppState, useClient } from "./context"
import type { AppMode } from "./context"
import { useDataLoader } from "./hooks/use-data-loader"
import { useMessageActions } from "./hooks/use-message-actions"

// ---------------------------------------------------------------------------
// Mode cycling order
// ---------------------------------------------------------------------------

const MODE_ORDER: AppMode[] = ["inbox", "sent", "directory"]

function nextMode(current: AppMode): AppMode {
  const idx = MODE_ORDER.indexOf(current)
  return MODE_ORDER[(idx + 1) % MODE_ORDER.length]
}

// ---------------------------------------------------------------------------
// Inner app (has access to context)
// ---------------------------------------------------------------------------

function AppInner() {
  const { exit } = useApp()
  const state = useAppState()
  const {
    setStatusMessage,
    setError,
    setOverlay,
    setMode,
    setSelectedIndex,
    setActiveMessage,
    setExpandedThread,
    setSearchActive,
    setSearchQuery,
    setSearchResults,
    setThreaded,
  } = state
  const { client } = useClient()
  const { refresh, loadInbox } = useDataLoader()
  const actions = useMessageActions()

  // Clear status messages after 3 seconds
  useEffect(() => {
    if (!state.statusMessage) return
    const timer = setTimeout(() => setStatusMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [state.statusMessage, setStatusMessage])

  // Clear errors after 5 seconds
  useEffect(() => {
    if (!state.error) return
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [state.error, setError])

  // Compute current list length for navigation bounds
  const getListLength = useCallback((): number => {
    if (state.searchActive) return state.searchResults.length
    switch (state.mode) {
      case "inbox":
        return state.threaded ? state.threads.length : state.flatMessages.length
      case "sent":
        return state.sentMessages.length
      case "directory":
        return state.directoryEntries.length
      default:
        return 0
    }
  }, [
    state.mode,
    state.searchActive,
    state.searchResults,
    state.threads,
    state.flatMessages,
    state.sentMessages,
    state.directoryEntries,
    state.threaded,
  ])

  // Get the message ID at the currently selected index
  const getSelectedMessageId = useCallback((): string | null => {
    if (state.searchActive) {
      return state.searchResults[state.selectedIndex]?.id ?? null
    }
    switch (state.mode) {
      case "inbox":
        if (state.threaded) {
          const thread = state.threads[state.selectedIndex]
          return thread?.lastMessage.id ?? null
        }
        return state.flatMessages[state.selectedIndex]?.id ?? null
      case "sent":
        return state.sentMessages[state.selectedIndex]?.id ?? null
      default:
        return null
    }
  }, [
    state.mode,
    state.searchActive,
    state.selectedIndex,
    state.searchResults,
    state.threads,
    state.flatMessages,
    state.sentMessages,
    state.threaded,
  ])

  // Get selected thread ID
  const getSelectedThreadId = useCallback((): string | null => {
    if (state.searchActive) {
      return state.searchResults[state.selectedIndex]?.threadId ?? null
    }
    if (state.mode === "inbox" && state.threaded) {
      return state.threads[state.selectedIndex]?.threadId ?? null
    }
    if (state.mode === "inbox") {
      return state.flatMessages[state.selectedIndex]?.threadId ?? null
    }
    if (state.mode === "sent") {
      return state.sentMessages[state.selectedIndex]?.threadId ?? null
    }
    return null
  }, [
    state.mode,
    state.searchActive,
    state.selectedIndex,
    state.searchResults,
    state.threads,
    state.flatMessages,
    state.sentMessages,
    state.threaded,
  ])

  // Handle compose via $EDITOR
  const handleCompose = useCallback(async () => {
    setOverlay("compose")
    try {
      // Build list of addresses for the To: hint
      const entries = state.directoryEntries
      const addressList =
        entries.length > 0 ? entries.map((e) => e.address).join(", ") : "(load directory first)"

      const template = `To: \nSubject: \n\n# Available addresses: ${addressList}\n# Write your message below. Lines starting with # are ignored.\n`
      const result = editInEditor(template)
      if (!result || !result.trim()) {
        setStatusMessage("Compose cancelled")
        return
      }
      const parsed = parseTemplate(result)
      const to = parsed.headers.to ?? ""
      const subject = parsed.headers.subject ?? ""
      if (!to || !subject) {
        setError("To and Subject are required")
        return
      }
      const recipients = to
        .split(",")
        .map((a: string) => a.trim())
        .filter(Boolean)
      await client.sendMessage({
        to: recipients,
        subject,
        body: parsed.body,
      })
      setStatusMessage(`Sent to ${recipients.join(", ")}`)
      await loadInbox()
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setOverlay("none")
    }
  }, [client, state.directoryEntries, loadInbox, setOverlay, setStatusMessage, setError])

  // Handle reply via $EDITOR
  const handleReply = useCallback(async () => {
    const msgId = state.activeMessage?.id ?? getSelectedMessageId()
    if (!msgId) return

    setOverlay("reply")
    try {
      const msg = state.activeMessage ?? (await client.readMessage(msgId, { includeThread: false }))
      const recipients = msg.recipients.map((r) => r.address).join(", ")
      const sender = msg.sender
      const allRecipients = [sender, ...recipients.split(",").map((a) => a.trim())]
        .filter(Boolean)
        .join(", ")

      const subjectPrefix = msg.subject.startsWith("Re: ") ? "" : "Re: "
      const template = `To: ${allRecipients}\nSubject: ${subjectPrefix}${msg.subject}\n\n# Replying to ${sender}\n# Original: ${msg.subject}\n`
      const result = editInEditor(template)
      if (!result || !result.trim()) {
        setStatusMessage("Reply cancelled")
        return
      }
      const parsed = parseTemplate(result)
      await client.sendMessage({
        body: parsed.body,
        inReplyTo: msgId,
      })
      setStatusMessage("Reply sent")
      await loadInbox()
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setOverlay("none")
    }
  }, [
    client,
    state.activeMessage,
    getSelectedMessageId,
    loadInbox,
    setOverlay,
    setStatusMessage,
    setError,
  ])

  // Handle keyboard input
  useInput(
    (input, key) => {
      // Overlays take priority
      if (state.overlay === "help") {
        if (key.escape || input === "?") {
          setOverlay("none")
        }
        return
      }

      if (state.overlay === "quickReply") {
        if (key.escape) {
          setOverlay("none")
        }
        return
      }

      if (state.overlay === "compose" || state.overlay === "reply") {
        // $EDITOR is running externally, ignore input
        return
      }

      // Search bar active — let TextInput handle most keys
      if (state.searchActive && state.mode !== "search") {
        // Only handle escape to clear search
        if (key.escape) {
          setSearchActive(false)
          setSearchQuery("")
          setSearchResults([])
          setSelectedIndex(0)
        }
        return
      }

      // Global shortcuts
      if (input === "q" && !key.ctrl) {
        exit()
        return
      }
      if (input === "?") {
        setOverlay("help")
        return
      }
      if (input === "g") {
        refresh()
        return
      }

      // Mode switching
      if (key.tab) {
        const next = nextMode(state.mode)
        setMode(next)
        setSelectedIndex(0)
        setActiveMessage(null)
        setExpandedThread(null)
        setSearchActive(false)
        return
      }

      // Search activation
      if (input === "/") {
        setSearchActive(true)
        setSearchQuery("")
        setSelectedIndex(0)
        return
      }

      // Navigation
      const len = getListLength()
      if ((input === "j" || key.downArrow) && len > 0) {
        const next = Math.min(state.selectedIndex + 1, len - 1)
        setSelectedIndex(next)
        setExpandedThread(null)

        // Auto-read on selection change
        const id = (() => {
          if (state.searchActive) return state.searchResults[next]?.id
          if (state.mode === "inbox" && state.threaded) return state.threads[next]?.lastMessage.id
          if (state.mode === "inbox") return state.flatMessages[next]?.id
          if (state.mode === "sent") return state.sentMessages[next]?.id
          return null
        })()
        if (id) actions.readMessage(id)
        return
      }
      if ((input === "k" || key.upArrow) && len > 0) {
        const next = Math.max(state.selectedIndex - 1, 0)
        setSelectedIndex(next)
        setExpandedThread(null)

        const id = (() => {
          if (state.searchActive) return state.searchResults[next]?.id
          if (state.mode === "inbox" && state.threaded) return state.threads[next]?.lastMessage.id
          if (state.mode === "inbox") return state.flatMessages[next]?.id
          if (state.mode === "sent") return state.sentMessages[next]?.id
          return null
        })()
        if (id) actions.readMessage(id)
        return
      }

      // Enter: expand thread or read message
      if (key.return) {
        const threadId = getSelectedThreadId()
        if (threadId) {
          actions.expandThread(threadId)
        }
        return
      }

      // Escape: close expanded thread or go back
      if (key.escape) {
        if (state.expandedThread) {
          setExpandedThread(null)
          return
        }
        if (state.searchActive) {
          setSearchActive(false)
          setSearchQuery("")
          setSearchResults([])
          setSelectedIndex(0)
          return
        }
        if (state.mode === "directory") {
          setMode("inbox")
          setSelectedIndex(0)
          return
        }
        setActiveMessage(null)
        return
      }

      // Inbox-specific actions
      if (state.mode === "inbox") {
        // Toggle threaded/flat
        if (input === "t") {
          setThreaded(!state.threaded)
          setSelectedIndex(0)
          setActiveMessage(null)
          setExpandedThread(null)
          return
        }

        // Archive
        if (input === "a") {
          const id = state.activeMessage?.id ?? getSelectedMessageId()
          if (id) {
            actions.archiveMessage(id).then(() => loadInbox())
          }
          return
        }

        // Mark unread
        if (input === "u") {
          const id = state.activeMessage?.id ?? getSelectedMessageId()
          if (id) {
            actions.markUnread(id).then(() => loadInbox())
          }
          return
        }

        // Reply via $EDITOR
        if (input === "r") {
          handleReply()
          return
        }

        // Quick reply
        if (input === "R" && state.activeMessage) {
          setOverlay("quickReply")
          return
        }

        // Compose
        if (input === "c") {
          handleCompose()
          return
        }
      }

      // Directory mode
      if (input === "d" && state.mode !== "directory") {
        setMode("directory")
        setSelectedIndex(0)
        return
      }
    },
    { isActive: state.overlay !== "quickReply" },
  )

  // Load first message detail on initial render
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — trigger on data load
  useEffect(() => {
    if (state.mode === "inbox" && state.activeMessage === null) {
      const id = getSelectedMessageId()
      if (id) actions.readMessage(id)
    }
  }, [state.threads, state.flatMessages])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Help overlay
  if (state.overlay === "help") {
    return (
      <Box flexDirection="column" height="100%">
        <Header />
        <HelpOverlay />
        <Footer />
      </Box>
    )
  }

  // Build left panel content based on mode
  let leftPanel: React.ReactNode

  if (state.searchActive && state.searchResults.length > 0) {
    leftPanel = (
      <Box flexDirection="column">
        <SearchBar
          value={state.searchQuery}
          onChange={state.setSearchQuery}
          onSubmit={(q) => actions.searchMessages(q)}
          active={true}
        />
        <SearchList results={state.searchResults} selectedIndex={state.selectedIndex} />
      </Box>
    )
  } else if (state.searchActive) {
    leftPanel = (
      <SearchBar
        value={state.searchQuery}
        onChange={state.setSearchQuery}
        onSubmit={(q) => actions.searchMessages(q)}
        active={true}
      />
    )
  } else {
    switch (state.mode) {
      case "inbox":
        leftPanel = state.threaded ? (
          <ThreadList threads={state.threads} selectedIndex={state.selectedIndex} />
        ) : (
          <FlatList messages={state.flatMessages} selectedIndex={state.selectedIndex} />
        )
        break
      case "sent":
        leftPanel = <FlatList messages={state.sentMessages} selectedIndex={state.selectedIndex} />
        break
      case "directory":
        leftPanel = (
          <DirectoryList entries={state.directoryEntries} selectedIndex={state.selectedIndex} />
        )
        break
    }
  }

  // Build right panel content
  let rightPanel: React.ReactNode

  if (state.expandedThread) {
    rightPanel = <ThreadView messages={state.expandedThread} />
  } else if (state.mode === "directory") {
    const entry = state.directoryEntries[state.selectedIndex]
    rightPanel = entry ? <DirectoryDetail entry={entry} /> : null
  } else if (state.activeMessage) {
    rightPanel = <MessageDetail message={state.activeMessage} />
  } else {
    rightPanel = (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>Select a message to read</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Box flexGrow={1} flexDirection="row">
        <Box
          width="45%"
          flexDirection="column"
          borderStyle="single"
          borderRight={true}
          borderLeft={false}
          borderTop={false}
          borderBottom={false}
        >
          {leftPanel}
        </Box>
        <Box width="55%" flexDirection="column">
          {rightPanel}
        </Box>
      </Box>
      {state.overlay === "quickReply" && state.activeMessage && (
        <QuickReply
          message={state.activeMessage}
          onSent={() => {
            setOverlay("none")
            setStatusMessage("Reply sent")
            loadInbox()
          }}
          onCancel={() => setOverlay("none")}
        />
      )}
      <Footer />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Root component (wraps with provider)
// ---------------------------------------------------------------------------

interface AppProps {
  client: EshuClient
  userAddress: string
  projectId: string
}

export function App({ client, userAddress, projectId }: AppProps) {
  return (
    <AppProvider client={client} userAddress={userAddress} projectId={projectId}>
      <AppInner />
    </AppProvider>
  )
}
