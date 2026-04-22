import { Box, Text } from "ink"
import TextInput from "ink-text-input"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  active: boolean
}

/**
 * Search input bar displayed at top of content area when search is active.
 */
export function SearchBar({ value, onChange, onSubmit, active }: SearchBarProps) {
  if (!active) return null

  return (
    <Box paddingX={1}>
      <Text color="yellow" bold>
        Search:{" "}
      </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder="type a query and press Enter..."
      />
    </Box>
  )
}
