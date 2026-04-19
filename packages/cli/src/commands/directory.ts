import { createInterface } from "node:readline"
import type { EshuClient } from "@eshu/api-client"
import type { Command } from "commander"
import { editInEditor, parseTemplate } from "../editor"
import { formatTable, pc, printJson, snippet } from "../format"

export function registerDirectoryCommand(program: Command, getClient: () => EshuClient): void {
  const dir = program.command("directory").description("Browse and manage the project directory")

  // -------------------------------------------------------------------------
  // eshu directory [list] — default subcommand
  // -------------------------------------------------------------------------

  dir
    .command("list", { isDefault: true })
    .description("List directory entries")
    .option("--type <type>", "Filter by human or agent")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = getClient()
      const entries = await client.directory(opts.type as "human" | "agent" | undefined)

      if (opts.json) {
        printJson(entries)
        return
      }

      if (entries.length === 0) {
        console.log("No directory entries found.")
        return
      }

      const rows = entries.map((e) => [
        e.address,
        e.displayName,
        e.type,
        snippet(e.description ?? "", 40),
      ])

      console.log()
      console.log(formatTable(["Address", "Name", "Type", "Description"], rows))
      console.log()
      console.log(`${entries.length} contact${entries.length === 1 ? "" : "s"}`)
    })

  // -------------------------------------------------------------------------
  // eshu directory add
  // -------------------------------------------------------------------------

  dir
    .command("add")
    .description("Add a new directory entry")
    .requiredOption("--address <address>", "Contact address (e.g. alice, auto/ci-fixer)")
    .requiredOption("--name <name>", "Display name")
    .requiredOption("--type <type>", "Type: human or agent")
    .option("--description <desc>", "Description of who they are")
    .option("--expectations <exp>", "What they expect from senders")
    .action(async (opts) => {
      const client = getClient()

      if (opts.type !== "human" && opts.type !== "agent") {
        throw new Error('--type must be "human" or "agent"')
      }

      await client.addDirectoryEntry({
        address: opts.address,
        displayName: opts.name,
        type: opts.type,
        description: opts.description ?? null,
        expectations: opts.expectations ?? null,
      })

      console.log(`Added ${pc.bold(opts.address)} to directory.`)
    })

  // -------------------------------------------------------------------------
  // eshu directory edit <address>
  // -------------------------------------------------------------------------

  dir
    .command("edit <address>")
    .description("Edit a directory entry (opens $EDITOR)")
    .action(async (address: string) => {
      const client = getClient()

      // Fetch current entry
      const entries = await client.directory()
      const entry = entries.find((e) => e.address === address)
      if (!entry) {
        throw new Error(`Directory entry not found: "${address}"`)
      }

      const template = [
        "# Edit directory entry. Lines starting with # are ignored.",
        "# Only displayName, description, and expectations can be changed.",
        "#",
        `displayName: ${entry.displayName}`,
        `description: ${entry.description ?? ""}`,
        `expectations: ${entry.expectations ?? ""}`,
        "",
      ].join("\n")

      const edited = editInEditor(template)
      if (!edited) {
        console.log("Edit cancelled.")
        return
      }

      const parsed = parseTemplate(edited)
      const updates: {
        displayName?: string
        description?: string | null
        expectations?: string | null
      } = {}

      if (parsed.headers.displayname && parsed.headers.displayname !== entry.displayName) {
        updates.displayName = parsed.headers.displayname
      }
      if (
        parsed.headers.description !== undefined &&
        parsed.headers.description !== (entry.description ?? "")
      ) {
        updates.description = parsed.headers.description || null
      }
      if (
        parsed.headers.expectations !== undefined &&
        parsed.headers.expectations !== (entry.expectations ?? "")
      ) {
        updates.expectations = parsed.headers.expectations || null
      }

      // If there's body content, treat it as an expanded expectations field
      if (parsed.body && parsed.body !== (entry.expectations ?? "")) {
        updates.expectations = parsed.body
      }

      if (Object.keys(updates).length === 0) {
        console.log("No changes detected.")
        return
      }

      await client.updateDirectoryEntry(address, updates)
      console.log(`Updated ${pc.bold(address)}.`)
    })

  // -------------------------------------------------------------------------
  // eshu directory remove <address>
  // -------------------------------------------------------------------------

  dir
    .command("remove <address>")
    .description("Remove a directory entry")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (address: string, opts) => {
      const client = getClient()

      if (!opts.yes) {
        const confirmed = await confirm(
          "Are you sure? This does not delete existing messages. [y/N]",
        )
        if (!confirmed) {
          console.log("Cancelled.")
          return
        }
      }

      await client.removeDirectoryEntry(address)
      console.log(`Removed ${pc.bold(address)} from directory.`)
    })
}

// ---------------------------------------------------------------------------
// Confirmation prompt
// ---------------------------------------------------------------------------

function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`${message} `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === "y")
    })
  })
}
