import type { InboxMessage, SearchResult, ThreadSummary } from "@eshu/shared"
import { Box, Text } from "ink"
import { relativeTime, shortId, snippet } from "../../format"

// ---------------------------------------------------------------------------
// Thread list item (threaded inbox)
// ---------------------------------------------------------------------------

interface ThreadItemProps {
  thread: ThreadSummary
  selected: boolean
}

function ThreadItem({ thread, selected }: ThreadItemProps) {
  const hasUnread = thread.unreadCount > 0
  const indicator = hasUnread ? "\u25cf " : "  "
  const sender = thread.lastMessage.senderName ?? thread.lastMessage.sender
  const time = relativeTime(new Date(thread.lastMessage.createdAt))
  const subj = snippet(thread.subject, 50)
  const threadInfo =
    thread.totalCount > 1 ? ` (${thread.totalCount} msgs, ${thread.unreadCount} unread)` : ""

  return (
    <Box>
      <Text color={selected ? "cyan" : undefined} bold={selected} inverse={selected}>
        {" "}
        <Text color={hasUnread ? "yellow" : "white"}>{indicator}</Text>
        <Text bold={hasUnread}>{sender}</Text>
        <Text dimColor>
          {"  "}
          {time}
        </Text>
        {"\n"}
        {"   "}
        <Text>{subj}</Text>
        <Text dimColor>{threadInfo}</Text>{" "}
      </Text>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Flat message item
// ---------------------------------------------------------------------------

interface FlatItemProps {
  message: InboxMessage
  selected: boolean
}

function FlatItem({ message, selected }: FlatItemProps) {
  const sender = message.senderName ?? message.sender
  const time = relativeTime(new Date(message.createdAt))
  const subj = snippet(message.subject, 50)
  const id = shortId(message.id)

  return (
    <Box>
      <Text color={selected ? "cyan" : undefined} bold={selected} inverse={selected}>
        {" "}
        <Text dimColor>{id}</Text>
        {"  "}
        <Text bold>{sender}</Text>
        {"  "}
        <Text>{subj}</Text>
        <Text dimColor>
          {"  "}
          {time}
        </Text>{" "}
      </Text>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Search result item
// ---------------------------------------------------------------------------

interface SearchItemProps {
  result: SearchResult
  selected: boolean
}

function SearchItem({ result, selected }: SearchItemProps) {
  const sender = result.senderName ?? result.sender
  const time = relativeTime(new Date(result.createdAt))
  const subj = snippet(result.subject, 45)
  const score = result.similarity.toFixed(2)

  return (
    <Box>
      <Text color={selected ? "cyan" : undefined} bold={selected} inverse={selected}>
        {" "}
        <Text color="magenta">{score}</Text>
        {"  "}
        <Text bold>{sender}</Text>
        {"  "}
        <Text>{subj}</Text>
        <Text dimColor>
          {"  "}
          {time}
        </Text>{" "}
      </Text>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// List components
// ---------------------------------------------------------------------------

interface ThreadListProps {
  threads: ThreadSummary[]
  selectedIndex: number
}

export function ThreadList({ threads, selectedIndex }: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>No threads to display</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      {threads.map((thread, i) => (
        <ThreadItem key={thread.threadId} thread={thread} selected={i === selectedIndex} />
      ))}
    </Box>
  )
}

interface FlatListProps {
  messages: InboxMessage[]
  selectedIndex: number
}

export function FlatList({ messages, selectedIndex }: FlatListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>No messages to display</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <FlatItem key={msg.id} message={msg} selected={i === selectedIndex} />
      ))}
    </Box>
  )
}

interface SearchListProps {
  results: SearchResult[]
  selectedIndex: number
}

export function SearchList({ results, selectedIndex }: SearchListProps) {
  if (results.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>No search results</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      {results.map((result, i) => (
        <SearchItem key={result.id} result={result} selected={i === selectedIndex} />
      ))}
    </Box>
  )
}
