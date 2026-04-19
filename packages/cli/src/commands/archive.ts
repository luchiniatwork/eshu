import type { EshuClient } from "@eshu/api-client"
import type { Command } from "commander"
import { shortId } from "../format"
import { resolveId } from "../id-cache"

export function registerArchiveCommands(program: Command, getClient: () => EshuClient): void {
  program
    .command("archive <id>")
    .description("Archive a message (hides from inbox, still searchable)")
    .action(async (id: string) => {
      const client = getClient()
      const messageId = resolveId(id)
      await client.archiveMessage(messageId)
      console.log(`Archived message ${shortId(messageId)}.`)
    })

  program
    .command("unarchive <id>")
    .description("Restore a message to inbox")
    .action(async (id: string) => {
      const client = getClient()
      const messageId = resolveId(id)
      await client.unarchiveMessage(messageId)
      console.log(`Restored message ${shortId(messageId)} to inbox.`)
    })
}
