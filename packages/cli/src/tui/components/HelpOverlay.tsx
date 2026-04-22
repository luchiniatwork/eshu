import { Box, Text } from "ink"

const HELP_SECTIONS = [
  {
    title: "Navigation",
    keys: [
      ["j / Down", "Move selection down"],
      ["k / Up", "Move selection up"],
      ["Enter", "Open message / expand thread"],
      ["Esc", "Close panel / clear search"],
    ],
  },
  {
    title: "Actions",
    keys: [
      ["r", "Reply to selected message"],
      ["c", "Compose new message"],
      ["a", "Archive / unarchive message"],
      ["u", "Mark message as unread"],
    ],
  },
  {
    title: "Modes",
    keys: [
      ["Tab", "Cycle modes: Inbox > Sent > Directory"],
      ["/", "Open search"],
      ["t", "Toggle threaded / flat view"],
      ["g", "Refresh data"],
    ],
  },
  {
    title: "General",
    keys: [
      ["?", "Toggle this help"],
      ["q / Ctrl+C", "Quit"],
    ],
  },
]

/**
 * Full-screen help overlay showing all keybindings.
 */
export function HelpOverlay() {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan">
        Eshu TUI — Keyboard Shortcuts
      </Text>
      <Text> </Text>
      {HELP_SECTIONS.map((section) => (
        <Box key={section.title} flexDirection="column" marginBottom={1}>
          <Text bold underline>
            {section.title}
          </Text>
          {section.keys.map(([key, desc]) => (
            <Text key={key}>
              {"  "}
              <Text color="yellow" bold>
                {key.padEnd(16)}
              </Text>
              <Text>{desc}</Text>
            </Text>
          ))}
        </Box>
      ))}
      <Text dimColor>Press Esc or ? to close</Text>
    </Box>
  )
}
