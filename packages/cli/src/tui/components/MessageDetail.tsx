import type { MessageDetail as MessageDetailType } from "@eshu/shared"
import { Box, Text } from "ink"
import { relativeTime } from "../../format"

interface MessageDetailProps {
  message: MessageDetailType
}

/**
 * Right panel: shows full message content with headers.
 */
export function MessageDetail({ message }: MessageDetailProps) {
  const sender = message.senderName ?? message.sender
  const recipients = message.recipients.map((r) => r.displayName ?? r.address).join(", ")
  const time = relativeTime(new Date(message.createdAt))
  const isReceipt = message.type === "receipt"

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      <Box flexDirection="column" marginBottom={1}>
        <Text>
          <Text dimColor>From: </Text>
          <Text bold>{sender}</Text>
        </Text>
        <Text>
          <Text dimColor>To: </Text>
          <Text>{recipients || "(none)"}</Text>
        </Text>
        <Text>
          <Text dimColor>Subject: </Text>
          <Text bold>{message.subject}</Text>
        </Text>
        <Text>
          <Text dimColor>Date: </Text>
          <Text>{time}</Text>
        </Text>
        {isReceipt && (
          <Text>
            <Text dimColor>Type: </Text>
            <Text color="magenta">Read Receipt</Text>
          </Text>
        )}
      </Box>
      <Box>
        <Text dimColor>{"─".repeat(60)}</Text>
      </Box>
      <Box marginTop={1}>
        <Text wrap="wrap">{message.body}</Text>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Thread view: shows all messages in a thread
// ---------------------------------------------------------------------------

interface ThreadViewProps {
  messages: MessageDetailType[]
}

export function ThreadView({ messages }: ThreadViewProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold dimColor>
        Thread ({messages.length} messages)
      </Text>
      <Box marginTop={1} flexDirection="column" gap={1}>
        {messages.map((msg) => (
          <ThreadMessage key={msg.id} message={msg} />
        ))}
      </Box>
    </Box>
  )
}

function ThreadMessage({ message }: { message: MessageDetailType }) {
  const sender = message.senderName ?? message.sender
  const time = relativeTime(new Date(message.createdAt))
  const isReceipt = message.type === "receipt"

  return (
    <Box flexDirection="column">
      <Text>
        <Text bold color={isReceipt ? "magenta" : "white"}>
          {sender}
        </Text>
        <Text dimColor>
          {"  "}
          {time}
        </Text>
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{message.body}</Text>
      </Box>
    </Box>
  )
}
