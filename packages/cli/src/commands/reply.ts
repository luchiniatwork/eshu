import type { EshuClient } from "@eshu/api-client"
import type { Command } from "commander"
import { editInEditor } from "../editor"
import { shortId } from "../format"
import { cacheIds, resolveId } from "../id-cache"

export function registerReplyCommand(program: Command, getClient: () => EshuClient): void {
  program
    .command("reply <id>")
    .description("Reply to a message")
    .option("--to <addresses>", "Override recipients (comma-separated)")
    .option("-b, --body <body>", "Reply body (if omitted, opens $EDITOR)")
    .action(async (id: string, opts) => {
      const client = getClient()
      const messageId = resolveId(id)

      // Fetch original message for context
      const original = await client.readMessage(messageId)

      let body: string | undefined
      let to: string[] | undefined

      if (opts.to) {
        to = opts.to.split(",").map((a: string) => a.trim())
      }

      if (opts.body) {
        body = opts.body
      } else {
        // Build editor template with quoted original
        const template = buildReplyTemplate(original)
        const edited = editInEditor(template)

        if (!edited) {
          console.log("Reply cancelled.")
          return
        }

        body = edited
        if (!body) {
          throw new Error("Reply body is empty.")
        }
      }

      if (!body) {
        throw new Error("Reply body is empty.")
      }

      const result = await client.sendMessage({
        inReplyTo: messageId,
        body,
        to,
      })

      cacheIds([result.id])
      console.log(`Sent reply ${shortId(result.id)} to ${result.recipients.join(", ")}.`)
    })
}

function buildReplyTemplate(original: {
  sender: string
  subject: string
  body: string
  recipients: Array<{ address: string }>
}): string {
  const recipients = original.recipients.map((r) => r.address).join(", ")
  const quotedBody = original.body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")

  const lines = [
    "# Reply to message. Lines starting with # are ignored.",
    `# To: ${recipients}`,
    `# Subject: Re: ${original.subject}`,
    `# Original from ${original.sender}:`,
    "#",
    `# ${quotedBody.replace(/\n/g, "\n# ")}`,
    "#",
    "# Write your reply below:",
    "",
    "",
  ]
  return lines.join("\n")
}
