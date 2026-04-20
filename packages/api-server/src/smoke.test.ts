import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import type { EshuClient } from "@eshu/api-client"
import { createClient } from "@eshu/api-client"
import { createDb } from "@eshu/shared"
import type { Database, ServerConfig } from "@eshu/shared"
import type { Kysely } from "kysely"
import { sql } from "kysely"
import { createApp } from "./app"

// ---------------------------------------------------------------------------
// Integration smoke tests
// ---------------------------------------------------------------------------
//
// Full API lifecycle: Client → HTTP → Server → Database.
// Requires a running PostgreSQL instance with pgvector enabled.
//
// Run with:  bun run test:integration
// Requires:  ESHU_DATABASE_URL (PostgreSQL with pgvector)
// Optional:  OPENAI_API_KEY (enables the semantic search test)
// ---------------------------------------------------------------------------

const DB_URL = process.env.ESHU_DATABASE_URL
const OPENAI_KEY = process.env.OPENAI_API_KEY
const PROJECT_ID = `smoke-test-${Date.now()}`

describe.skipIf(!DB_URL)("smoke tests (integration)", () => {
  let db: Kysely<Database>
  let server: ReturnType<typeof Bun.serve>
  let alice: EshuClient
  let bob: EshuClient

  beforeAll(async () => {
    const dbUrl = DB_URL as string

    db = createDb(dbUrl)

    const config: ServerConfig = {
      projectId: PROJECT_ID,
      databaseUrl: dbUrl,
      openaiApiKey: OPENAI_KEY ?? "dummy-key-for-non-search-tests",
      apiPort: 0,
      apiKey: null,
      embeddingModel: "text-embedding-3-small",
      searchThreshold: 0.25,
      searchLimit: 20,
    }

    const app = createApp(config, db)
    server = Bun.serve({ port: 0, fetch: app.fetch })
    const baseUrl = `http://localhost:${server.port}`

    alice = createClient({ apiUrl: baseUrl, address: "alice" })
    bob = createClient({ apiUrl: baseUrl, address: "bob" })

    // Set up directory entries for both users
    await alice.addDirectoryEntry({
      address: "alice",
      displayName: "Alice (Engineer)",
      type: "human",
      description: "Backend engineer",
      expectations: "Brief updates",
    })
    await alice.addDirectoryEntry({
      address: "bob",
      displayName: "Bob (Engineer)",
      type: "human",
      description: "Frontend engineer",
      expectations: "Concise messages with context",
    })
  })

  afterAll(async () => {
    try {
      await sql`DELETE FROM mailbox_entry WHERE message_id IN (SELECT id FROM message WHERE project_id = ${PROJECT_ID})`.execute(
        db,
      )
      await sql`DELETE FROM message_recipient WHERE message_id IN (SELECT id FROM message WHERE project_id = ${PROJECT_ID})`.execute(
        db,
      )
      await sql`UPDATE message SET in_reply_to = NULL WHERE project_id = ${PROJECT_ID}`.execute(db)
      await sql`DELETE FROM message WHERE project_id = ${PROJECT_ID}`.execute(db)
      await sql`DELETE FROM directory_entry WHERE project_id = ${PROJECT_ID}`.execute(db)
    } catch {
      // Best-effort cleanup
    }

    server?.stop()
    await db?.destroy()
  })

  // -------------------------------------------------------------------------
  // Test 1: End-to-end lifecycle
  // -------------------------------------------------------------------------

  test("end-to-end: send, inbox, read, reply, archive", async () => {
    // Alice sends a message to Bob
    const sent = await alice.sendMessage({
      to: ["bob"],
      subject: "Auth service deploy blocked",
      body: "Build #4521 failed. Health check returns 503.",
    })
    expect(sent.id).toBeDefined()
    expect(sent.recipients).toEqual(["bob"])

    // Bob sees it in his inbox
    const bobInbox = await bob.inboxFlat({ unreadOnly: true })
    const found = bobInbox.find((m) => m.id === sent.id)
    expect(found).toBeDefined()
    expect(found?.subject).toBe("Auth service deploy blocked")

    // Bob reads the message
    const read = await bob.readMessage(sent.id)
    expect(read.body).toBe("Build #4521 failed. Health check returns 503.")
    expect(read.sender).toBe("alice")

    // Bob replies
    const reply = await bob.sendMessage({
      body: "Looking into it. Might be a connection pool issue.",
      inReplyTo: sent.id,
    })
    expect(reply.threadId).toBe(sent.threadId)

    // Alice sees the reply
    const aliceInbox = await alice.inboxFlat({ unreadOnly: true })
    const replyFound = aliceInbox.find((m) => m.id === reply.id)
    expect(replyFound).toBeDefined()

    // Alice archives the reply
    const archived = await alice.archiveMessage(reply.id)
    expect(archived.archived).toBe(true)

    // Archived message is hidden from inbox
    const afterArchive = await alice.inboxFlat({ unreadOnly: true })
    expect(afterArchive.find((m) => m.id === reply.id)).toBeUndefined()

    // But visible with includeArchived
    const withArchived = await alice.inboxFlat({
      unreadOnly: false,
      includeArchived: true,
    })
    expect(withArchived.find((m) => m.id === reply.id)).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Test 2: Threading
  // -------------------------------------------------------------------------

  test("threading: three-message thread reconstruction", async () => {
    // Alice starts a new thread
    const msg1 = await alice.sendMessage({
      to: ["bob"],
      subject: "Connection pool sizing",
      body: "We need to increase the pool from 10 to 25.",
    })

    // Bob replies
    const msg2 = await bob.sendMessage({
      body: "Agreed. Should we also add timeout settings?",
      inReplyTo: msg1.id,
    })
    expect(msg2.threadId).toBe(msg1.threadId)

    // Alice replies again
    const msg3 = await alice.sendMessage({
      body: "Yes, set idle timeout to 30s.",
      inReplyTo: msg2.id,
    })
    expect(msg3.threadId).toBe(msg1.threadId)

    // Read with thread context — verify all 3 messages in order
    const detail = await bob.readMessage(msg3.id, { includeThread: true })
    expect(detail.thread).toBeDefined()

    const thread = detail.thread ?? []
    expect(thread).toHaveLength(3)

    // Chronological order
    const ids = thread.map((m) => m.id)
    expect(ids).toEqual([msg1.id, msg2.id, msg3.id])

    // Subjects
    expect(thread[0].subject).toBe("Connection pool sizing")
    expect(thread[1].subject).toBe("Re: Connection pool sizing")
    expect(thread[2].subject).toBe("Re: Connection pool sizing")
  })

  // -------------------------------------------------------------------------
  // Test 3: Read receipts
  // -------------------------------------------------------------------------

  test("read receipts: auto-generated on first read", async () => {
    // Alice sends with receipt requested
    const sent = await alice.sendMessage({
      to: ["bob"],
      subject: "Urgent: prod migration",
      body: "Please confirm you reviewed the rollback plan.",
      receiptRequested: true,
    })

    // Bob reads the message — triggers auto-receipt
    await bob.readMessage(sent.id)

    // Alice should have a receipt in her inbox
    const aliceInbox = await alice.inboxFlat({ unreadOnly: true })
    const receipt = aliceInbox.find((m) => m.threadId === sent.threadId && m.id !== sent.id)
    expect(receipt).toBeDefined()
    expect(receipt?.subject).toBe("Read: Urgent: prod migration")

    // Verify the receipt message details
    const receiptId = receipt?.id
    expect(receiptId).toBeDefined()

    const receiptDetail = await alice.readMessage(receiptId as string, { includeThread: true })
    expect(receiptDetail.type).toBe("receipt")
    expect(receiptDetail.sender).toBe("bob")
    expect(receiptDetail.body).toContain("bob has read your message")

    // Thread should have original + receipt
    const thread = receiptDetail.thread ?? []
    expect(thread).toHaveLength(2)
  })

  // -------------------------------------------------------------------------
  // Test 4: Semantic search (requires OPENAI_API_KEY)
  // -------------------------------------------------------------------------

  describe.skipIf(!OPENAI_KEY)("semantic search", () => {
    test("search returns semantically ranked results", async () => {
      // Send topically distinct messages
      await alice.sendMessage({
        to: ["bob"],
        subject: "React component refactoring",
        body: "Refactoring Dashboard to use React hooks instead of class components.",
      })
      await alice.sendMessage({
        to: ["bob"],
        subject: "Database backup schedule",
        body: "Move nightly PostgreSQL backups from 2am to 4am UTC.",
      })
      await alice.sendMessage({
        to: ["bob"],
        subject: "API rate limiting",
        body: "Token bucket algorithm with 100 req/min per API key.",
      })

      // Search for database-related content
      const results = await bob.searchMessages("PostgreSQL backup issues")
      expect(results.length).toBeGreaterThan(0)

      // The database backup message should rank first
      expect(results[0].subject).toBe("Database backup schedule")
      expect(results[0].similarity).toBeGreaterThan(0.3)
    })
  })
})
