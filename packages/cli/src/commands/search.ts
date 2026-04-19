import type { EshuClient } from "@eshu/api-client"
import type { Command } from "commander"
import { formatTable, pc, printJson, relativeTime, shortId, snippet } from "../format"
import { cacheIds } from "../id-cache"

export function registerSearchCommand(program: Command, getClient: () => EshuClient): void {
  program
    .command("search <query>")
    .description("Search messages by natural-language query")
    .option("--folder <folder>", "Search folder: inbox, sent, or all", "inbox")
    .option("-n, --limit <n>", "Max results", "20")
    .option("--archived", "Include archived messages")
    .option("--json", "Output as JSON")
    .action(async (query: string, opts) => {
      const client = getClient()
      const results = await client.searchMessages(query, {
        folder: opts.folder as "inbox" | "sent" | "all",
        limit: Number.parseInt(opts.limit, 10),
        includeArchived: opts.archived ?? false,
      })

      if (opts.json) {
        printJson(results)
        return
      }

      if (results.length === 0) {
        console.log("No results found.")
        return
      }

      cacheIds(results.map((r) => r.id))

      const rows = results.map((r) => [
        pc.dim(shortId(r.id)),
        r.similarity.toFixed(2),
        r.sender,
        snippet(r.subject, 40),
        relativeTime(r.createdAt),
      ])

      console.log()
      console.log(formatTable(["ID", "Score", "From", "Subject", "Date"], rows))
      console.log()
      console.log(`${results.length} result${results.length === 1 ? "" : "s"}`)
    })
}
