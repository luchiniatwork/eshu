import type { EshuClient } from "@eshu/api-client"
import type { Command } from "commander"
import { formatTable, pc, printJson, relativeTime, shortId, snippet } from "../format"
import { cacheIds } from "../id-cache"

export function registerInboxCommand(program: Command, getClient: () => EshuClient): void {
  program
    .command("inbox")
    .description("View messages in your mailbox")
    .option("--all", "Show all messages, not just unread")
    .option("--mode <mode>", "Display mode: threaded or flat", "threaded")
    .option("-n, --limit <n>", "Max results", "20")
    .option("--archived", "Include archived messages")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = getClient()
      const unreadOnly = !opts.all
      const limit = Number.parseInt(opts.limit, 10)
      const includeArchived = opts.archived ?? false

      if (opts.mode === "flat") {
        const messages = await client.inboxFlat({ unreadOnly, limit, includeArchived })

        if (opts.json) {
          printJson(messages)
          return
        }

        if (messages.length === 0) {
          console.log(unreadOnly ? "No unread messages." : "No messages.")
          return
        }

        cacheIds(messages.map((m) => m.id))

        const rows = messages.map((m) => [
          pc.dim(shortId(m.id)),
          m.sender,
          snippet(m.subject, 45),
          relativeTime(m.createdAt),
        ])

        console.log()
        console.log(formatTable(["ID", "From", "Subject", "Received"], rows))
        console.log()
        console.log(`${messages.length} message${messages.length === 1 ? "" : "s"}`)
      } else {
        const threads = await client.inboxThreaded({ unreadOnly, limit, includeArchived })

        if (opts.json) {
          printJson(threads)
          return
        }

        if (threads.length === 0) {
          console.log(unreadOnly ? "No unread messages." : "No messages.")
          return
        }

        cacheIds(threads.map((t) => t.lastMessage.id))

        const rows = threads.map((t) => {
          const unread = t.unreadCount > 0 ? pc.bold(`(${t.unreadCount} unread)`) : ""
          const threadInfo =
            t.totalCount > 1 ? pc.dim(` [${t.totalCount} msgs${unread ? ` ${unread}` : ""}]`) : ""
          return [
            pc.dim(shortId(t.lastMessage.id)),
            t.lastMessage.sender,
            `${snippet(t.subject, 40)}${threadInfo}`,
            relativeTime(t.lastMessage.createdAt),
          ]
        })

        console.log()
        console.log(formatTable(["ID", "From", "Subject", "Received"], rows))
        console.log()

        const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0)
        if (totalUnread > 0) {
          console.log(`${totalUnread} unread message${totalUnread === 1 ? "" : "s"}`)
        } else {
          console.log(`${threads.length} thread${threads.length === 1 ? "" : "s"}`)
        }
      }
    })
}
