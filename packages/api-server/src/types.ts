import type { Database, ServerConfig } from "@eshu/shared"
import type { Kysely } from "kysely"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Hono environment type
// ---------------------------------------------------------------------------

export type AppEnv = {
  Variables: {
    db: Kysely<Database>
    config: ServerConfig
    projectId: string
    callerAddress: string
  }
}

// ---------------------------------------------------------------------------
// Request validation schemas
// ---------------------------------------------------------------------------

export const DirectoryListSchema = z.object({
  type: z.enum(["human", "agent"]).optional(),
})

export const DirectoryAddSchema = z.object({
  address: z.string().min(1, "Address is required"),
  displayName: z.string().min(1, "Display name is required"),
  type: z.enum(["human", "agent"]),
  description: z.string().nullable().optional(),
  expectations: z.string().nullable().optional(),
})

export const DirectoryUpdateSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    expectations: z.string().nullable().optional(),
  })
  .refine(
    (data) =>
      data.displayName !== undefined ||
      data.description !== undefined ||
      data.expectations !== undefined,
    { message: "At least one field must be provided for update" },
  )

export const InboxSchema = z.object({
  unreadOnly: z.boolean().default(true),
  mode: z.enum(["threaded", "flat"]).default("threaded"),
  limit: z.number().int().positive().max(100).default(20),
  includeArchived: z.boolean().default(false),
})

export const ReadMessageSchema = z.object({
  includeThread: z.boolean().default(false),
})

export const SearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  folder: z.enum(["inbox", "sent", "all"]).default("inbox"),
  limit: z.number().int().positive().max(100).default(20),
  includeArchived: z.boolean().default(false),
})

export const SentSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
})

export const SendMessageSchema = z.object({
  to: z.array(z.string().min(1)).min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1, "Message body is required"),
  inReplyTo: z.string().uuid().optional(),
  receiptRequested: z.boolean().default(false),
})
