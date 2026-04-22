import type { MessageDetail } from "@eshu/shared"
import { Box, Text } from "ink"
import TextInput from "ink-text-input"
import { useState } from "react"
import { useClient } from "../context"

interface QuickReplyProps {
  message: MessageDetail
  onSent: () => void
  onCancel: () => void
}

/**
 * Inline quick-reply bar for short responses.
 */
export function QuickReply({ message, onSent, onCancel }: QuickReplyProps) {
  const { client } = useClient()
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)
  const recipients = message.recipients.map((r) => r.address).join(", ")

  async function handleSubmit(body: string) {
    if (!body.trim() || sending) return
    setSending(true)
    try {
      await client.sendMessage({
        body: body.trim(),
        inReplyTo: message.id,
      })
      onSent()
    } catch {
      // Error will be shown via global error state
      onCancel()
    }
  }

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      <Text dimColor>
        Reply to {message.senderName ?? message.sender} (cc: {recipients})
      </Text>
      <Box>
        <Text color="cyan" bold>
          {"> "}
        </Text>
        {sending ? (
          <Text dimColor>Sending...</Text>
        ) : (
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder="Type a quick reply... (Enter to send, Esc to cancel)"
          />
        )}
      </Box>
    </Box>
  )
}
