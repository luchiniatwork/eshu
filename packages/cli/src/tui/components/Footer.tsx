import { Box, Text } from "ink"
import { useAppState } from "../context"
import type { AppMode, Overlay } from "../context"

function getHints(mode: AppMode, overlay: Overlay, searchActive: boolean): string {
  if (overlay === "help") return "[Esc] Close help"
  if (overlay === "quickReply") return "[Enter] Send  [Esc] Cancel"

  const common = "[q] Quit  [?] Help  [g] Refresh"

  if (searchActive) {
    return `[j/k] Navigate  [Enter] Read  [Esc] Clear search  ${common}`
  }

  switch (mode) {
    case "inbox":
      return `[j/k] Navigate  [Enter] Thread  [r] Reply  [c] Compose  [a] Archive  [u] Unread  [/] Search  [t] Toggle view  [Tab] Mode  ${common}`
    case "sent":
      return `[j/k] Navigate  [Enter] Read  [Tab] Mode  ${common}`
    case "search":
      return `[j/k] Navigate  [Enter] Read  [Esc] Back  ${common}`
    case "directory":
      return `[j/k] Navigate  [Esc] Back  ${common}`
    default:
      return common
  }
}

/**
 * Bottom bar showing context-dependent keybinding hints.
 */
export function Footer() {
  const { mode, overlay, searchActive, error, statusMessage } = useAppState()

  return (
    <Box flexDirection="column">
      {error && (
        <Box paddingX={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
      {statusMessage && !error && (
        <Box paddingX={1}>
          <Text color="green">{statusMessage}</Text>
        </Box>
      )}
      <Box
        borderStyle="single"
        borderTop={true}
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        paddingX={1}
      >
        <Text dimColor>{getHints(mode, overlay, searchActive)}</Text>
      </Box>
    </Box>
  )
}
