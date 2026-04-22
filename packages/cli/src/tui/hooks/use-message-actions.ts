import { useCallback } from "react"
import { useAppState, useClient } from "../context"

/**
 * Provides message action functions: read, archive, unread, search.
 */
export function useMessageActions() {
  const { client } = useClient()
  const state = useAppState()
  const {
    activeMessage,
    setActiveMessage,
    setExpandedThread,
    setError,
    setStatusMessage,
    setSearchResults,
    setSearchActive,
    setLoading,
  } = state

  const readMessage = useCallback(
    async (messageId: string) => {
      try {
        const detail = await client.readMessage(messageId, { includeThread: true })
        setActiveMessage(detail)
        setExpandedThread(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read message")
      }
    },
    [client, setActiveMessage, setExpandedThread, setError],
  )

  const archiveMessage = useCallback(
    async (messageId: string) => {
      try {
        const result = await client.archiveMessage(messageId)
        setStatusMessage(result.archived ? "Archived" : "Unarchived")
        if (activeMessage?.id === messageId) {
          setActiveMessage(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to archive")
      }
    },
    [client, activeMessage, setStatusMessage, setActiveMessage, setError],
  )

  const unarchiveMessage = useCallback(
    async (messageId: string) => {
      try {
        await client.unarchiveMessage(messageId)
        setStatusMessage("Restored to inbox")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to unarchive")
      }
    },
    [client, setStatusMessage, setError],
  )

  const markUnread = useCallback(
    async (messageId: string) => {
      try {
        await client.markUnread(messageId)
        setStatusMessage("Marked as unread")
        if (activeMessage?.id === messageId) {
          setActiveMessage(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to mark as unread")
      }
    },
    [client, activeMessage, setStatusMessage, setActiveMessage, setError],
  )

  const expandThread = useCallback(
    async (threadId: string) => {
      try {
        const thread = await client.getThread(threadId)
        setExpandedThread(thread)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load thread")
      }
    },
    [client, setExpandedThread, setError],
  )

  const searchMessages = useCallback(
    async (query: string) => {
      if (!query.trim()) return
      setLoading(true)
      try {
        const results = await client.searchMessages(query, {
          folder: "all",
          limit: 30,
        })
        setSearchResults(results)
        setSearchActive(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed")
      } finally {
        setLoading(false)
      }
    },
    [client, setLoading, setSearchResults, setSearchActive, setError],
  )

  return {
    readMessage,
    archiveMessage,
    unarchiveMessage,
    markUnread,
    expandThread,
    searchMessages,
  }
}
