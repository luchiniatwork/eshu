import type { EshuClient, MessageDetail } from "@eshu/api-client"
import type { Command } from "commander"
import { pc, printJson, relativeTime, separator, shortId } from "../format"
import { cacheIds, resolveId } from "../id-cache"

export function registerReadCommand(program: Command, getClient: () => EshuClient): void {
  program
    .command("read <id>")
    .description("Read a message and mark it as read")
    .option("-t, --thread", "Show full thread context")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      const client = getClient()
      const messageId = resolveId(id)
      const message = await client.readMessage(messageId, {
        includeThread: opts.thread ?? false,
      })

      // Cache this message's ID and any thread message IDs
      const idsToCache = [message.id]
      if (message.thread) {
        idsToCache.push(...message.thread.map((m) => m.id))
      }
      cacheIds(idsToCache)

      if (opts.json) {
        printJson(message)
        return
      }

      if (opts.thread && message.thread && message.thread.length > 0) {
        printThread(message.thread, message.id)
      } else {
        printMessage(message)
      }
    })
}

function printMessage(msg: MessageDetail): void {
  const recipients = msg.recipients.map((r) => r.address).join(", ")
  const senderDisplay = msg.senderName ? `${msg.sender} (${msg.senderName})` : msg.sender

  console.log()
  console.log(`  ${pc.bold("From:")}     ${senderDisplay}`)
  console.log(`  ${pc.bold("To:")}       ${recipients}`)
  console.log(`  ${pc.bold("Subject:")}  ${msg.subject}`)
  console.log(
    `  ${pc.bold("Date:")}     ${new Date(msg.createdAt).toUTCString()} (${relativeTime(msg.createdAt)})`,
  )

  if (msg.type === "receipt") {
    console.log(`  ${pc.bold("Type:")}     ${pc.dim("read receipt")}`)
  }

  console.log()
  console.log(`  ${separator(60)}`)
  console.log()

  // Indent body lines
  const bodyLines = msg.body.split("\n")
  for (const line of bodyLines) {
    console.log(`  ${line}`)
  }

  console.log()
  console.log(`  ${separator(60)}`)
  console.log()
}

function printThread(thread: MessageDetail[], currentId: string): void {
  console.log()
  console.log(`  ${pc.bold("Thread")} (${thread.length} message${thread.length === 1 ? "" : "s"})`)
  console.log()

  for (const msg of thread) {
    const isCurrent = msg.id === currentId
    const marker = isCurrent ? pc.bold(">>>") : "   "
    const senderDisplay = msg.senderName ? `${msg.sender} (${msg.senderName})` : msg.sender
    const header = `${marker} ${pc.dim(shortId(msg.id))}  ${pc.bold(senderDisplay)}  ${pc.dim(relativeTime(msg.createdAt))}`

    console.log(header)
    console.log(`       ${pc.bold(msg.subject)}`)
    console.log()

    const bodyLines = msg.body.split("\n")
    for (const line of bodyLines) {
      console.log(`       ${isCurrent ? line : pc.dim(line)}`)
    }

    console.log()
    console.log(`  ${separator(60)}`)
    console.log()
  }
}
