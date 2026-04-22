import { getSentMessages } from "@eshu/shared"
import type { Context } from "hono"
import { SentSchema } from "../types"
import type { AppEnv } from "../types"
import { resolveDisplayNames } from "./resolve"

/**
 * POST /api/v1/sent — Get messages sent by the caller.
 */
export async function sentHandler(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => ({}))
  const { limit } = SentSchema.parse(body)

  const db = c.get("db")
  const projectId = c.get("projectId")
  const sender = c.get("callerAddress")

  const messages = await getSentMessages(db, projectId, sender, { limit })

  const senderAddresses = messages.map((m) => m.sender)
  const names = await resolveDisplayNames(db, projectId, senderAddresses)

  for (const msg of messages) {
    msg.senderName = names.get(msg.sender) ?? null
  }

  return c.json(messages)
}
