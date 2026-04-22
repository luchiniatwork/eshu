import type { DirectoryEntry } from "@eshu/shared"
import { Box, Text } from "ink"

interface DirectoryListProps {
  entries: DirectoryEntry[]
  selectedIndex: number
}

export function DirectoryList({ entries, selectedIndex }: DirectoryListProps) {
  if (entries.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>No directory entries</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {entries.map((entry, i) => (
        <DirectoryItem key={entry.id} entry={entry} selected={i === selectedIndex} />
      ))}
    </Box>
  )
}

function DirectoryItem({ entry, selected }: { entry: DirectoryEntry; selected: boolean }) {
  const typeColor = entry.type === "human" ? "green" : "blue"
  const typeLabel = entry.type === "human" ? "H" : "A"

  return (
    <Box>
      <Text color={selected ? "cyan" : undefined} bold={selected} inverse={selected}>
        {" "}
        <Text color={typeColor}>[{typeLabel}]</Text>
        {"  "}
        <Text bold>{entry.address}</Text>
        <Text dimColor>
          {"  "}
          {entry.displayName}
        </Text>{" "}
      </Text>
    </Box>
  )
}

interface DirectoryDetailProps {
  entry: DirectoryEntry
}

export function DirectoryDetail({ entry }: DirectoryDetailProps) {
  const typeColor = entry.type === "human" ? "green" : "blue"

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text>
          <Text dimColor>Address: </Text>
          <Text bold>{entry.address}</Text>
        </Text>
        <Text>
          <Text dimColor>Name: </Text>
          <Text>{entry.displayName}</Text>
        </Text>
        <Text>
          <Text dimColor>Type: </Text>
          <Text color={typeColor}>{entry.type}</Text>
        </Text>
      </Box>
      {entry.description && (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor bold>
            Description
          </Text>
          <Text wrap="wrap">{entry.description}</Text>
        </Box>
      )}
      {entry.expectations && (
        <Box flexDirection="column">
          <Text dimColor bold>
            Expectations
          </Text>
          <Text wrap="wrap">{entry.expectations}</Text>
        </Box>
      )}
    </Box>
  )
}
