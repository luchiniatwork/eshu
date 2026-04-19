import type { EshuClient } from "@eshu/api-client"
import type { Command } from "commander"
import { editInEditor, parseTemplate } from "../editor"
import { shortId } from "../format"
import { cacheIds } from "../id-cache"

export function registerSendCommand(program: Command, getClient: () => EshuClient): void {
  program
    .command("send")
    .description("Send a new message")
    .option("--to <addresses>", "Recipients (comma-separated addresses)")
    .option("-s, --subject <subject>", "Subject line")
    .option("-b, --body <body>", "Message body (if omitted, opens $EDITOR)")
    .option("--receipt", "Request read receipts")
    .action(async (opts) => {
      const client = getClient()

      let to: string[] | undefined
      let subject: string | undefined
      let body: string | undefined

      if (opts.body) {
        // Inline mode: --to, --subject, and --body are all required
        if (!opts.to) {
          throw new Error("--to is required when using --body (or omit --body to use $EDITOR)")
        }
        if (!opts.subject) {
          throw new Error("--subject is required when using --body (or omit --body to use $EDITOR)")
        }
        to = opts.to.split(",").map((a: string) => a.trim())
        subject = opts.subject
        body = opts.body
      } else {
        // Editor mode
        const template = buildTemplate(opts.to, opts.subject)
        const edited = editInEditor(template)

        if (!edited) {
          console.log("Message cancelled.")
          return
        }

        const parsed = parseTemplate(edited)
        to = parsed.headers.to?.split(",").map((a: string) => a.trim())
        subject = parsed.headers.subject
        body = parsed.body

        if (!to || to.length === 0) {
          throw new Error("Recipients (To:) are required.")
        }
        if (!subject) {
          throw new Error("Subject is required.")
        }
        if (!body) {
          throw new Error("Message body is empty.")
        }
      }

      if (!body) {
        throw new Error("Message body is empty.")
      }

      const result = await client.sendMessage({
        to,
        subject,
        body,
        receiptRequested: opts.receipt ?? false,
      })

      cacheIds([result.id])
      console.log(`Sent message ${shortId(result.id)} to ${result.recipients.join(", ")}.`)
    })
}

function buildTemplate(to?: string, subject?: string): string {
  const lines = [
    "# Compose a new message. Lines starting with # are ignored.",
    "#",
    `To: ${to ?? ""}`,
    `Subject: ${subject ?? ""}`,
    "",
    "",
  ]
  return lines.join("\n")
}
