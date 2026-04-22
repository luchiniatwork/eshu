import { useCallback, useEffect, useRef } from "react"
import { useAppState, useClient } from "../context"

const REFRESH_INTERVAL_MS = 30_000

/**
 * Loads inbox/sent/directory data and sets up auto-refresh (30s).
 * Also provides a manual refresh function.
 */
export function useDataLoader() {
  const { client, userAddress } = useClient()
  const state = useAppState()
  const {
    threaded,
    mode,
    setThreads,
    setFlatMessages,
    setError,
    setUnreadCount,
    setSentMessages,
    setDirectoryEntries,
    setLoading,
  } = state
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadInbox = useCallback(async () => {
    try {
      if (threaded) {
        const threads = await client.inboxThreaded({
          unreadOnly: false,
          limit: 50,
        })
        setThreads(threads)
      } else {
        const messages = await client.inboxFlat({
          unreadOnly: false,
          limit: 50,
        })
        setFlatMessages(messages)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inbox")
    }
  }, [client, threaded, setThreads, setFlatMessages, setError])

  const loadUnreadCount = useCallback(async () => {
    try {
      const stats = await client.stats()
      const entry = stats.unread.find((u) => u.address === userAddress)
      setUnreadCount(entry?.count ?? 0)
    } catch {
      // Non-critical, silently ignore
    }
  }, [client, userAddress, setUnreadCount])

  const loadSent = useCallback(async () => {
    try {
      const messages = await client.sentMessages({ limit: 50 })
      setSentMessages(messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sent messages")
    }
  }, [client, setSentMessages, setError])

  const loadDirectory = useCallback(async () => {
    try {
      const entries = await client.directory()
      setDirectoryEntries(entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory")
    }
  }, [client, setDirectoryEntries, setError])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadInbox(), loadUnreadCount()])
      if (mode === "sent") await loadSent()
      if (mode === "directory") await loadDirectory()
    } finally {
      setLoading(false)
    }
  }, [loadInbox, loadUnreadCount, loadSent, loadDirectory, mode, setLoading, setError])

  // Initial load — intentionally runs once on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount
  useEffect(() => {
    refresh()
  }, [])

  // Reload when mode changes
  useEffect(() => {
    if (mode === "sent") loadSent()
    if (mode === "directory") loadDirectory()
  }, [mode, loadSent, loadDirectory])

  // Reload inbox when threaded toggle changes
  useEffect(() => {
    loadInbox()
  }, [loadInbox])

  // Auto-refresh timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      loadInbox()
      loadUnreadCount()
    }, REFRESH_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loadInbox, loadUnreadCount])

  return { refresh, loadInbox, loadSent, loadDirectory }
}
