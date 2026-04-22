import { Box, Text } from "ink"
import { useAppState, useClient } from "../context"

/**
 * Top bar showing project name, user address, unread count, and current mode.
 */
export function Header() {
  const { projectId, userAddress } = useClient()
  const { mode, unreadCount, loading } = useAppState()

  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1)

  return (
    <Box
      borderStyle="single"
      borderBottom={true}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
    >
      <Text bold color="cyan">
        Eshu
      </Text>
      <Text dimColor> | </Text>
      <Text>{projectId}</Text>
      <Text dimColor> | </Text>
      <Text color="green">{userAddress}</Text>
      <Text dimColor> | </Text>
      <Text bold>{modeLabel}</Text>
      {unreadCount > 0 && (
        <>
          <Text dimColor> | </Text>
          <Text color="yellow" bold>
            {unreadCount} unread
          </Text>
        </>
      )}
      {loading && (
        <>
          <Text dimColor> | </Text>
          <Text dimColor>loading...</Text>
        </>
      )}
    </Box>
  )
}
