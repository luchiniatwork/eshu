# Eshu — Agent Messaging System Specification

## 1. Overview

A messaging system for AI coding agents (and humans). Agents send and
receive structured messages through simple MCP tools. Humans
participate via a terminal mail client (TUI). A shared directory tells
every participant who's available and what they expect from incoming
messages.

The name comes from the Yoruba orisha Eshu — the messenger at the
crossroads, intermediary between realms. Eshu bridges the agent realm
and the human realm.

### Design Principles

- **Email-simple, agent-native.** Six tools cover everything an agent
  needs. No MIME types, no folders, no headers — just send, read,
  search, archive, and check inbox.
- **The directory is the protocol.** Each contact publishes what they
  expect from senders. Agents read the directory before composing a
  message, shaping their communication to match the recipient's
  contract.
- **Threading preserves context.** Messages belong to threads.
  Conversations stay coherent across multiple agents and humans. Flat
  mode is available for agents that prefer a simple chronological
  view.
- **Humans are first-class.** Humans and agents share the same
  address space, the same threads, the same mailbox semantics. The
  only difference is the interface: agents use MCP tools, humans use
  the TUI.
- **CLI and MCP at parity.** Every core messaging capability is
  available through both the CLI (for humans and CLI-based agents)
  and the MCP server (for MCP-connected agents). Both are thin
  clients over the same REST API — one interface never lags behind
  the other. Two agent skills (one per interface) teach agents the
  same proactive messaging habits.
- **Humans validate first.** The CLI and TUI are built before the
  MCP server. Humans dogfood the messaging system, validating the
  data model and directory design with human judgment before agents
  start using it.
- **Pull-based, skill-driven.** Agents check their inbox at session
  start, driven by an installable agent skill. No push
  infrastructure, no webhooks, no polling loops.
- **Zero new infrastructure beyond PostgreSQL.** Like its sibling
  project Moneta, everything runs on PostgreSQL with pgvector. No
  message broker, no queue, no separate search engine.

### Non-Goals (for v1)

- Push notifications or webhooks.
- Attachments or file sharing.
- Groups or mailing lists (broadcast to a type of agent).
- End-to-end encryption.
- Cross-project messaging (one deployment = one project).
- Rate limiting or spam prevention between agents.
- Agent self-registration in the directory (admin-managed in v1).

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Agent Fleet                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │Agent A-1│ │Agent A-2│ │Agent B-1│ │  Auto-1 │  ...       │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
│       └──────┬─────┘──────────┘────────────┘                 │
│              │ MCP Protocol                                   │
│              ▼                                                │
│  ┌───────────────────────┐                                    │
│  │    MCP Server         │  Tools: directory, inbox,          │
│  │    (TypeScript)       │  read_message, search_messages,    │
│  │                       │  send_message, archive_message     │
│  └───────────┬───────────┘                                    │
│              │ HTTP (REST API)                                 │
│  ┌───────────┴───────────┐                                    │
│  │    CLI / TUI          │  Human mail interface               │
│  │    (TypeScript)       │                                    │
│  └───────────┬───────────┘                                    │
│              │ HTTP (REST API)                                 │
│              ▼                                                │
│  ┌───────────────────────────────────────────────┐            │
│  │    REST API Server (Hono)                     │            │
│  │    Message routing, directory, search,         │            │
│  │    embeddings, read receipts                   │            │
│  └───────────┬───────────────────────────────────┘            │
│              │ PostgreSQL client + OpenAI                      │
│              ▼                                                │
│  ┌───────────────────────────────────────────────┐            │
│  │       PostgreSQL + pgvector                    │            │
│  │  directory_entry, message, mailbox_entry,      │            │
│  │  message_recipient tables                      │            │
│  │  + HNSW index for semantic search              │            │
│  │  + full-text search indexes                    │            │
│  └───────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Role | Talks To |
|---|---|---|
| **MCP Server** | Agent-facing API. Six tools for messaging. Thin adapter over the REST API. | REST API (via API client) |
| **REST API Server** | Business logic. Message routing, embedding generation, directory management, receipt handling. | PostgreSQL, OpenAI Embeddings |
| **CLI / TUI** | Human mail interface. Read, reply, search, manage directory. | REST API (via API client) |
| **PostgreSQL** | Persistence, vector search, full-text search. All data lives here. | — |

### Key Architectural Decision: API-First

Unlike Moneta (which added its REST API layer in Phase 8 as a
refactor), Eshu starts API-first from day one. The MCP server and CLI
are both thin clients over the REST API. This avoids the MCP-talks-
directly-to-DB pattern and the refactoring cost of introducing the API
layer later.

---

## 3. Data Model

### 3.1 Table: `directory_entry`

The directory is the contact registry for the project. Each entry
describes a participant — who they are, and what they expect from
incoming messages.

```sql
CREATE TABLE directory_entry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      TEXT NOT NULL,

    -- Identity
    address         TEXT NOT NULL,           -- "alice", "alice/code-reviewer", "auto/ci-fixer"
    display_name    TEXT NOT NULL,           -- "Alice (PM)", "Code Review Bot"
    type            TEXT NOT NULL CHECK (type IN ('human', 'agent')),

    -- Communication contract
    description     TEXT,                    -- who they are, what they do
    expectations    TEXT,                    -- what they expect from senders (the key feature)

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (project_id, address)
);
```

#### Directory Entry Examples

```
address:      alice
display_name: Alice (Project Manager)
type:         human
description:  Project manager for the platform team. Oversees sprint
              planning, tracks blockers, coordinates cross-team work.
expectations: Brief status updates only. Flag blockers immediately
              with impact assessment. No code snippets or technical
              details unless explicitly asked. Prefer bullet points.
              Don't message about routine progress — only
              exceptions and decisions that need human input.

address:      alice/code-reviewer
display_name: Code Review Bot (Alice)
type:         agent
description:  Automated code review agent. Reviews PRs for style,
              correctness, and architectural consistency.
expectations: Send PR URLs with specific file paths to focus on.
              Include context about why the change was made and what
              architectural decisions are relevant. If the PR touches
              the auth system, mention it explicitly.

address:      auto/ci-fixer
display_name: CI Remediation Bot
type:         agent
description:  Autonomous agent that investigates and fixes CI
              failures. Monitors build pipelines.
expectations: Build log URLs and error messages. Include the branch
              name and PR number. Specify whether the failure is
              flaky (seen before) or novel. Do NOT message if the
              failure is already assigned to another agent.
```

### 3.2 Table: `message`

Messages are the core content unit. Each message belongs to a thread,
may reply to a parent message, and has a type distinguishing regular
messages from system-generated read receipts.

```sql
CREATE TABLE message (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          TEXT NOT NULL,

    -- Threading
    thread_id           UUID NOT NULL,              -- root message ID (= own ID for thread starters)
    in_reply_to         UUID REFERENCES message(id),

    -- Content
    sender              TEXT NOT NULL,               -- directory address
    subject             TEXT NOT NULL,
    body                TEXT NOT NULL,               -- markdown

    -- Type: regular message or system-generated read receipt
    type                TEXT NOT NULL DEFAULT 'message'
                        CHECK (type IN ('message', 'receipt')),

    -- Read receipt request (only meaningful for type = 'message')
    receipt_requested   BOOLEAN NOT NULL DEFAULT false,

    -- Semantic search
    embedding           VECTOR(1536),

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Threading Rules

1. A new message (no `in_reply_to`) sets `thread_id = id` (self-
   referencing). It is the thread root.
2. A reply sets `thread_id` to the root message's `thread_id` and
   `in_reply_to` to the message being replied to.
3. All messages in a thread share the same `thread_id`.
4. Thread subjects are determined by the root message. Replies may
   override the subject but the thread grouping is by `thread_id`,
   not by subject.

#### Receipt Messages

When a message has `receipt_requested = true` and a recipient reads
it, the system auto-generates a receipt message in the same thread:

- `sender` = the reader's address
- `type` = `'receipt'`
- `subject` = `"Read: "` + original subject
- `body` = structured receipt info (human-readable)
- `receipt_requested` = `false` (receipts don't request further
  receipts)
- `in_reply_to` = the original message ID
- `thread_id` = the thread's root ID

The receipt message gets a mailbox entry for the **original sender
only** — not all thread participants. This prevents receipt spam.

### 3.3 Table: `mailbox_entry`

Each recipient of a message gets their own mailbox entry. This tracks
per-recipient state: read/unread and archived.

```sql
CREATE TABLE mailbox_entry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES message(id),
    recipient       TEXT NOT NULL,               -- directory address
    read_at         TIMESTAMPTZ,                 -- null = unread
    archived        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One entry per recipient per message
    UNIQUE (message_id, recipient)
);
```

### 3.4 Table: `message_recipient`

Denormalized recipient list on each message. Used for "reply-all"
resolution — when replying, the system can look up who was on the
original message.

```sql
CREATE TABLE message_recipient (
    message_id      UUID NOT NULL REFERENCES message(id),
    recipient       TEXT NOT NULL,
    PRIMARY KEY (message_id, recipient)
);
```

### 3.5 Indexes

```sql
-- Inbox hot path: unread, non-archived messages for a recipient
CREATE INDEX idx_mailbox_inbox
    ON mailbox_entry (recipient, created_at DESC)
    WHERE read_at IS NULL AND NOT archived;

-- All mailbox entries for a recipient (for search, archive browsing)
CREATE INDEX idx_mailbox_recipient
    ON mailbox_entry (recipient, created_at DESC);

-- Thread reconstruction: all messages in a thread, ordered
CREATE INDEX idx_message_thread
    ON message (thread_id, created_at);

-- Messages by sender (for "sent" folder)
CREATE INDEX idx_message_sender
    ON message (sender, created_at DESC);

-- Full-text search on subject + body
CREATE INDEX idx_message_fts
    ON message USING gin (
        to_tsvector('english', subject || ' ' || body)
    );

-- Semantic search: HNSW for approximate nearest neighbor
CREATE INDEX idx_message_embedding
    ON message USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Directory lookups
CREATE INDEX idx_directory_project
    ON directory_entry (project_id, address);

-- Message recipients for reply-all resolution
CREATE INDEX idx_message_recipient_lookup
    ON message_recipient (message_id);

-- Receipts: find receipt-requested messages for a given message
CREATE INDEX idx_message_receipt_pending
    ON message (id)
    WHERE receipt_requested AND type = 'message';
```

### 3.6 Functions

#### `search_messages` — Semantic search within a recipient's mailbox

```sql
CREATE OR REPLACE FUNCTION search_messages(
    p_project_id    TEXT,
    p_recipient     TEXT,
    p_embedding     VECTOR(1536),
    p_limit         INT DEFAULT 20,
    p_threshold     FLOAT DEFAULT 0.25,
    p_folder        TEXT DEFAULT 'inbox',   -- 'inbox', 'sent', 'all'
    p_include_archived BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id              UUID,
    thread_id       UUID,
    sender          TEXT,
    subject         TEXT,
    body            TEXT,
    type            TEXT,
    similarity      FLOAT,
    created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.thread_id,
        m.sender,
        m.subject,
        m.body,
        m.type,
        (1 - (m.embedding <=> p_embedding))::FLOAT AS similarity,
        m.created_at
    FROM message m
    WHERE m.project_id = p_project_id
      AND m.embedding IS NOT NULL
      AND (1 - (m.embedding <=> p_embedding)) > p_threshold
      AND (
          -- Inbox: messages in recipient's mailbox
          (p_folder = 'inbox' AND EXISTS (
              SELECT 1 FROM mailbox_entry me
              WHERE me.message_id = m.id
                AND me.recipient = p_recipient
                AND (p_include_archived OR NOT me.archived)
          ))
          OR
          -- Sent: messages sent by this address
          (p_folder = 'sent' AND m.sender = p_recipient)
          OR
          -- All: inbox + sent
          (p_folder = 'all' AND (
              m.sender = p_recipient
              OR EXISTS (
                  SELECT 1 FROM mailbox_entry me
                  WHERE me.message_id = m.id
                    AND me.recipient = p_recipient
                    AND (p_include_archived OR NOT me.archived)
              )
          ))
      )
    ORDER BY m.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$;
```

---

## 4. Identity & Address Model

### 4.1 Address Format

Eshu extends Moneta's agent identity model to include humans as
first-class addresses:

| Address | Type | Example |
|---|---|---|
| `{name}` | Human | `alice`, `bob` |
| `{engineer}/{agent-type}` | Human-directed agent | `alice/code-reviewer` |
| `auto/{agent-type}` | Autonomous agent | `auto/ci-fixer` |

The address is the primary key for communication. It maps to a
directory entry (if registered) and is used in sender/recipient
fields on messages and mailbox entries.

### 4.2 Address Decomposition

```
alice                → { address: "alice", type: "human", engineer: "alice" }
alice/code-reviewer  → { address: "alice/code-reviewer", type: "agent",
                          engineer: "alice", agentType: "code-reviewer" }
auto/ci-fixer        → { address: "auto/ci-fixer", type: "agent",
                          engineer: null, agentType: "ci-fixer" }
```

### 4.3 Per-Connection Configuration

Each MCP client connection is configured with the agent's address.
This is set at connection time, not per-request:

```json
{
    "project_id": "acme-platform",
    "agent_address": "alice/code-reviewer"
}
```

The MCP server injects this address as the `sender` on every
`send_message` call and as the `recipient` for inbox/read/search
operations.

---

## 5. MCP Server

### 5.1 Tools

#### `directory`

Browse the project's contact directory. Returns all registered
participants with their descriptions and communication expectations.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `type` | enum | no | Filter by `"human"` or `"agent"`. Omit for all. |

**Returns:** Array of directory entries:

```json
[
    {
        "address": "alice",
        "displayName": "Alice (Project Manager)",
        "type": "human",
        "description": "Project manager for the platform team...",
        "expectations": "Brief status updates only. Flag blockers immediately..."
    },
    {
        "address": "auto/ci-fixer",
        "displayName": "CI Remediation Bot",
        "type": "agent",
        "description": "Autonomous agent that investigates CI failures...",
        "expectations": "Build log URLs and error messages..."
    }
]
```

**Behavior:**

1. Query `directory_entry` for the agent's `project_id`.
2. Apply optional `type` filter.
3. Return all matching entries with full descriptions and
   expectations.
4. The directory is expected to be small (tens of entries, not
   thousands). No pagination needed for v1.

---

#### `inbox`

Check for messages in the agent's mailbox.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `unread_only` | boolean | no | Only unread messages. Default `true`. |
| `mode` | enum | no | `"threaded"` (default) or `"flat"`. |
| `limit` | integer | no | Max results. Default 20. |
| `include_archived` | boolean | no | Include archived messages. Default `false`. |

**Returns (threaded mode):** Array of thread summaries:

```json
[
    {
        "threadId": "uuid-1",
        "subject": "Deploy blocked: auth service failing health checks",
        "lastMessage": {
            "id": "uuid-3",
            "sender": "bob/debugger",
            "senderName": "Debugger Bot (Bob)",
            "snippet": "Found the root cause — connection pool exhaustion in...",
            "createdAt": "2026-04-17T10:30:00Z"
        },
        "unreadCount": 2,
        "totalCount": 5,
        "participants": ["alice", "bob/debugger", "auto/ci-fixer"]
    }
]
```

**Returns (flat mode):** Array of individual messages:

```json
[
    {
        "id": "uuid-3",
        "sender": "bob/debugger",
        "senderName": "Debugger Bot (Bob)",
        "subject": "Re: Deploy blocked: auth service failing health checks",
        "snippet": "Found the root cause — connection pool exhaustion in...",
        "createdAt": "2026-04-17T10:30:00Z",
        "threadId": "uuid-1"
    }
]
```

**Behavior:**

1. Query `mailbox_entry` for the agent's address.
2. If `unread_only`: filter to `read_at IS NULL`.
3. If not `include_archived`: filter to `archived = false`.
4. In threaded mode: group by `thread_id`, return thread summaries
   with the latest message, unread count, and participant list.
5. In flat mode: return individual messages chronologically.
6. Join with `directory_entry` to resolve `senderName`.

---

#### `read_message`

Read a specific message. Marks it as read in the agent's mailbox.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `message_id` | string | yes | UUID of the message to read. |
| `include_thread` | boolean | no | Include full thread context. Default `false`. |

**Returns:**

```json
{
    "id": "uuid-3",
    "threadId": "uuid-1",
    "sender": "bob/debugger",
    "senderName": "Debugger Bot (Bob)",
    "recipients": [
        { "address": "alice", "displayName": "Alice (PM)" },
        { "address": "auto/ci-fixer", "displayName": "CI Remediation Bot" }
    ],
    "subject": "Re: Deploy blocked: auth service failing health checks",
    "body": "Found the root cause — connection pool exhaustion in the auth service...",
    "type": "message",
    "createdAt": "2026-04-17T10:30:00Z",
    "thread": [
        {
            "id": "uuid-1",
            "sender": "auto/ci-fixer",
            "subject": "Deploy blocked: auth service failing health checks",
            "body": "Build #4521 failed. Health check endpoint /health returns 503...",
            "type": "message",
            "createdAt": "2026-04-17T09:15:00Z"
        },
        {
            "id": "uuid-2",
            "sender": "alice",
            "subject": "Re: Deploy blocked: auth service failing health checks",
            "body": "Can someone investigate? This is blocking the release.",
            "type": "message",
            "createdAt": "2026-04-17T09:45:00Z"
        }
    ]
}
```

**Behavior:**

1. Fetch the message from the `message` table.
2. Verify the agent has a `mailbox_entry` for this message (agents
   can only read messages addressed to them, or messages they sent).
3. Set `read_at = now()` on the agent's `mailbox_entry` (if it
   exists and was unread).
4. **Read receipt handling:** If the message has
   `receipt_requested = true` and this is the first time the agent
   reads it (i.e., `read_at` was NULL before):
   a. Create a receipt message in the same thread (see section 3.2).
   b. Create a `mailbox_entry` for the receipt, addressed to the
      original message's sender only.
   c. Create a `message_recipient` entry for the original sender.
5. If `include_thread`: fetch all messages with the same `thread_id`,
   ordered by `created_at`, and include in the response.
6. Join with `directory_entry` to resolve display names.
7. Join with `message_recipient` to build the recipients list.

---

#### `search_messages`

Search the agent's mailbox using a natural-language query (semantic
search).

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `query` | string | yes | Natural language search query. |
| `folder` | enum | no | `"inbox"` (default), `"sent"`, or `"all"`. |
| `limit` | integer | no | Max results. Default 20. |
| `include_archived` | boolean | no | Include archived messages. Default `false`. |

**Returns:** Array of search results ranked by semantic similarity:

```json
[
    {
        "id": "uuid-3",
        "threadId": "uuid-1",
        "sender": "bob/debugger",
        "senderName": "Debugger Bot (Bob)",
        "subject": "Re: Deploy blocked: auth service failing health checks",
        "snippet": "Found the root cause — connection pool exhaustion...",
        "similarity": 0.78,
        "createdAt": "2026-04-17T10:30:00Z"
    }
]
```

**Behavior:**

1. Generate embedding for `query` using the configured embedding
   model.
2. Call the `search_messages()` SQL function with the embedding,
   recipient address, folder filter, and similarity threshold.
3. Join with `directory_entry` to resolve sender display names.
4. Return results ranked by similarity, with a text snippet
   (first ~200 chars of body).

---

#### `send_message`

Send a message to one or more recipients. Can be a new message or a
reply to an existing thread.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `to` | string[] | yes* | Directory addresses of recipients. |
| `subject` | string | yes* | Message subject line. |
| `body` | string | yes | Message body (markdown). |
| `in_reply_to` | string | no | Message ID to reply to. When set, auto-inherits thread and recipients. |
| `receipt_requested` | boolean | no | Request read receipts from recipients. Default `false`. |

\* `to` and `subject` are required for new messages. For replies
(`in_reply_to` is set), both are optional — `to` defaults to
reply-all (all recipients + sender of the parent, minus self) and
`subject` defaults to `"Re: "` + thread root subject.

**Returns:**

```json
{
    "id": "uuid-new",
    "threadId": "uuid-1",
    "recipientCount": 3,
    "recipients": ["alice", "bob/debugger", "auto/ci-fixer"]
}
```

**Behavior:**

1. **New message** (no `in_reply_to`):
   a. Validate `to` and `subject` are provided.
   b. Validate all addresses in `to` exist in the directory.
   c. Insert message with `thread_id = id` (new thread).
   d. Generate embedding for `subject + "\n\n" + body`.
   e. Create `message_recipient` entries for all recipients.
   f. Create `mailbox_entry` for each recipient (unread).

2. **Reply** (`in_reply_to` is set):
   a. Fetch the parent message. Validate it exists.
   b. Resolve thread: `thread_id` = parent's `thread_id`.
   c. Resolve recipients: if `to` is omitted, default to reply-all
      (all `message_recipient` entries on the parent + parent's
      sender, minus the current agent's address).
   d. Resolve subject: if omitted, `"Re: "` + thread root's subject.
      Avoid stacking "Re: Re: Re: " — if root subject already starts
      with `"Re: "`, don't add another.
   e. Insert message, generate embedding, create recipient and
      mailbox entries.

3. **Validation:**
   - Body must not be empty.
   - All recipients must exist in the directory.
   - `in_reply_to` message must exist if provided.
   - Sender must be registered in the directory.

---

#### `archive_message`

Archive or unarchive a message in the agent's mailbox. Archived
messages are hidden from the inbox but remain searchable.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `message_id` | string | yes | UUID of the message to archive or unarchive. |
| `archive` | boolean | no | `true` to archive (default), `false` to unarchive. |

**Returns:**

```json
{
    "id": "uuid-3",
    "archived": true
}
```

**Behavior:**

1. Verify the agent has a `mailbox_entry` for this message.
2. Set `archived` to the requested value on the agent's
   `mailbox_entry`.
3. This is a per-recipient action — archiving does not affect
   other recipients of the same message.

---

### 5.2 CLI / MCP Feature Parity

The CLI and MCP server expose the same core messaging capabilities
through the shared REST API. The CLI has additional commands for
directory management (admin-only) and statistics (human dashboard)
that are not exposed as MCP tools.

| Capability | CLI Command | MCP Tool |
|---|---|---|
| Browse directory | `eshu directory` | `directory` |
| Check inbox | `eshu inbox` | `inbox` |
| Read a message | `eshu read <id>` | `read_message` |
| Search messages | `eshu search <query>` | `search_messages` |
| Send / reply | `eshu send`, `eshu reply <id>` | `send_message` |
| Archive / unarchive | `eshu archive`, `eshu unarchive` | `archive_message` |
| Directory management | `eshu directory add/edit/remove` | — (admin-only) |
| Statistics | `eshu stats` | — (human dashboard) |
| Interactive UI | `eshu tui` | — (human-only) |

Two agent skills are provided — one for each interface — teaching
the same proactive messaging habits via the appropriate commands or
tools. See `agent-skills/eshu-messaging-mcp/` and
`agent-skills/eshu-messaging-cli/`.

### 5.3 Embedding Strategy

- **Model:** `text-embedding-3-small` (OpenAI). 1536 dimensions.
  Same as Moneta for consistency across the ecosystem.
- **What gets embedded:** `subject + "\n\n" + body` concatenated.
- **When:** Embedding is generated at send time, stored on the
  message. One embedding per message.
- **Receipt messages** (`type = 'receipt'`): embedded like any other
  message, but will naturally have low similarity to substantive
  queries.

### 5.4 Error Handling

| Error | Behavior |
|---|---|
| Recipient not in directory | Reject with `"Unknown recipient: {address}"`. List valid addresses. |
| Message not found | Return clear `"Message not found: {id}"` error. |
| Not authorized to read | Agent can only read messages in their mailbox or messages they sent. |
| Embedding API down | Store message without embedding. Log warning. Search will miss it. |
| Database unreachable | Return error to agent. No silent failures. |
| Empty body | Reject. |
| Reply to non-existent message | Reject with clear error. |

---

## 6. Message Lifecycle

```
            ┌──────────────────┐
            │ Agent/Human      │
            │ calls            │
            │ send_message()   │
            └───────┬──────────┘
                    │
                    ▼
            ┌──────────────────┐
            │ Validate         │
            │ recipients       │
            │ (directory       │
            │  lookup)         │
            └───────┬──────────┘
                    │
                    ▼
            ┌──────────────────┐
            │ INSERT message   │
            │ Generate         │
            │ embedding        │
            │ Create mailbox   │
            │ entries          │
            └───────┬──────────┘
                    │
       ┌────────────┼────────────────┐
       ▼            ▼                ▼
  ┌──────────┐ ┌──────────┐   ┌──────────┐
  │ inbox()  │ │ search() │   │ read()   │
  │ shows as │ │ finds    │   │ marks as │
  │ unread   │ │ by query │   │ read     │
  └──────────┘ └──────────┘   └────┬─────┘
                                   │
                          ┌────────┴────────┐
                          │ receipt_        │
                          │ requested?      │
                          └───┬─────────┬───┘
                           yes│         │no
                              ▼         │
                   ┌──────────────┐     │
                   │ Auto-create  │     │
                   │ receipt msg  │     │
                   │ in thread    │     │
                   │ (to sender   │     │
                   │  only)       │     │
                   └──────────────┘     │
                              │         │
                              ▼         ▼
                        ┌──────────┐
                        │ archive()│
                        │ hides    │
                        │ from     │
                        │ inbox    │
                        └──────────┘
```

### Archive Behavior

- Archive is a **per-recipient action**. Archiving a message hides
  it from the recipient's inbox but does not affect other recipients.
- Archived messages are still searchable (with
  `include_archived: true`).
- There is no auto-archival. Messages persist indefinitely.
- There is no deletion (for v1). An admin `purge` CLI command may
  be added later for maintenance.
- Unarchiving restores a message to the inbox view.

---

## 7. CLI / TUI

A command-line tool and interactive terminal interface for humans to
participate in messaging. Connects to the REST API (not directly to
the database).

### 7.1 Project Name and Invocation

The CLI binary is `eshu`. All commands operate on a configured
project.

```
eshu [command] [options]
```

### 7.2 CLI Commands

#### `eshu inbox`

View messages in the human's mailbox.

```
$ eshu inbox

  #  From                  Subject                                          Received
  1  auto/ci-fixer         Deploy blocked: auth service failing health...   10m ago
  2  alice/code-reviewer   PR #342: Review needed — auth token rotation     45m ago
  3  bob/debugger          Re: Connection pool investigation                2h ago

3 unread messages
```

**Options:**

| Flag | Description |
|---|---|
| `--all` | Show all messages, not just unread |
| `--mode` | `threaded` (default) or `flat` |
| `--limit, -n` | Max results (default 20) |
| `--archived` | Include archived messages |
| `--json` | Output as JSON |

#### `eshu read <id>`

Read a message and mark it as read.

```
$ eshu read a1b2c3

  From:     auto/ci-fixer (CI Remediation Bot)
  To:       alice, bob/debugger
  Subject:  Deploy blocked: auth service failing health checks
  Date:     2026-04-17 09:15 UTC (3 hours ago)
  Thread:   3 messages (2 unread)

  ─────────────────────────────────────────────

  Build #4521 failed. Health check endpoint /health returns 503.

  Error from logs:
  > Error: Connection pool exhausted. All 10 connections in use.

  Branch: feature/token-rotation
  PR: #342

  ─────────────────────────────────────────────
  [r] Reply  [R] Reply All  [a] Archive  [n] Next unread  [q] Back
```

**Options:**

| Flag | Description |
|---|---|
| `--thread, -t` | Show full thread context |
| `--json` | Output as JSON |

#### `eshu reply <id>`

Reply to a message. Opens `$EDITOR` to compose the reply.

```
$ eshu reply a1b2c3
# Opens $EDITOR with template:
# ---
# To: auto/ci-fixer, bob/debugger
# Subject: Re: Deploy blocked: auth service failing health checks
# ---
#
# (compose your reply here)

Sent reply to auto/ci-fixer, bob/debugger.
```

**Options:**

| Flag | Description |
|---|---|
| `--to` | Override recipients (instead of reply-all) |
| `--body, -b` | Inline body (skip $EDITOR) |

#### `eshu send`

Compose a new message.

```
$ eshu send --to auto/ci-fixer --subject "Investigate flaky test" --body "..."
Sent message to auto/ci-fixer.
```

**Options:**

| Flag | Description |
|---|---|
| `--to` | Recipients (comma-separated addresses) |
| `--subject, -s` | Subject line |
| `--body, -b` | Message body (if omitted, opens $EDITOR) |
| `--receipt` | Request read receipts |

#### `eshu search <query>`

Search messages by natural-language query.

```
$ eshu search "connection pool issues"

  #  Score  From              Subject                                     Date
  1  0.78   bob/debugger      Re: Deploy blocked: auth service failing... 2h ago
  2  0.65   auto/ci-fixer     Deploy blocked: auth service failing...     3h ago
  3  0.42   alice/architect   Connection pool sizing for PostgreSQL       5d ago

3 results (threshold: 0.25)
```

**Options:**

| Flag | Description |
|---|---|
| `--folder` | `inbox` (default), `sent`, or `all` |
| `--limit, -n` | Max results (default 20) |
| `--threshold, -t` | Min similarity (default 0.25) |
| `--archived` | Include archived messages |
| `--json` | Output as JSON |

#### `eshu archive <id>` / `eshu unarchive <id>`

Archive or restore a message.

```
$ eshu archive a1b2c3
Archived message a1b2c3.

$ eshu unarchive a1b2c3
Restored message a1b2c3 to inbox.
```

#### `eshu directory`

List the project directory.

```
$ eshu directory

  Address               Name                    Type    Description
  alice                 Alice (PM)              human   Project manager for the platform team...
  alice/code-reviewer   Code Review Bot         agent   Automated code review agent...
  bob                   Bob (Engineer)          human   Backend engineer, auth team lead...
  auto/ci-fixer         CI Remediation Bot      agent   Investigates and fixes CI failures...

4 contacts
```

**Options:**

| Flag | Description |
|---|---|
| `--type` | Filter by `human` or `agent` |
| `--json` | Output as JSON |

#### `eshu directory add`

Add a new directory entry.

```
$ eshu directory add \
    --address "auto/deploy-bot" \
    --name "Deploy Bot" \
    --type agent \
    --description "Handles production deployments" \
    --expectations "Send deployment targets, branch names, and approval status."

Added auto/deploy-bot to directory.
```

#### `eshu directory edit <address>`

Edit a directory entry. Opens `$EDITOR` with current values.

#### `eshu directory remove <address>`

Remove a directory entry.

```
$ eshu directory remove auto/deploy-bot
Are you sure? This does not delete existing messages. [y/N] y
Removed auto/deploy-bot from directory.
```

#### `eshu stats`

Overview dashboard.

```
$ eshu stats

  Project: acme-platform
  ─────────────────────────────────────────

  Messages:
    Total:              1,247
    This week:            89
    Threads:             312

  Directory:
    Humans:               4
    Agents:               8

  By participant (last 7 days):
    auto/ci-fixer        34 sent, 12 received
    alice/code-reviewer  28 sent, 19 received
    alice                 3 sent, 41 received
    bob                   8 sent, 15 received

  Unread messages:
    alice                 5 unread
    bob                   2 unread
    auto/ci-fixer         0 unread
```

### 7.3 TUI Mode

An interactive terminal mail client. Launched via `eshu tui` or
simply `eshu` with no arguments.

#### Layout

```
┌─ Eshu ─ acme-platform ─ alice ─ 5 unread ─────────────────────────────┐
│                                                                         │
│  Search: ______________________________________           [F1 Help]    │
│                                                                         │
│  ┌─ Inbox ─────────────────────────────────────┬─ Message ────────────┐│
│  │                                              │                      ││
│  │  ● auto/ci-fixer                    10m ago │ From: auto/ci-fixer  ││
│  │    Deploy blocked: auth service...          │ To: alice, bob/debug ││
│  │    ▸ 3 messages (2 unread)                  │ Date: 10 minutes ago ││
│  │                                              │                      ││
│  │  ● alice/code-reviewer              45m ago │ Build #4521 failed.  ││
│  │    PR #342: Review needed                   │ Health check endpoint││
│  │                                              │ /health returns 503. ││
│  │    bob/debugger                      2h ago │                      ││
│  │    Re: Connection pool investigation        │ Error from logs:     ││
│  │                                              │ > Connection pool    ││
│  │                                              │ > exhausted. All 10  ││
│  │                                              │ > connections in use ││
│  │                                              │                      ││
│  │                                              │ Branch: feature/     ││
│  │                                              │ token-rotation       ││
│  │                                              │ PR: #342             ││
│  │                                              │                      ││
│  └──────────────────────────────────────────────┴──────────────────────┘│
│                                                                         │
│  [/] Search  [r] Reply  [a] Archive  [d] Directory  [Tab] Mode  [q] Q │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Keybindings

| Key | Action |
|---|---|
| `/` | Focus search bar. Type query, press Enter to search. |
| `↑` `↓` or `j` `k` | Navigate message list |
| `Enter` | Open/expand selected message or thread |
| `r` | Reply to selected message (opens inline editor or $EDITOR) |
| `R` | Reply-all (explicit — same as `r` since reply-all is default) |
| `c` | Compose new message |
| `a` | Archive / unarchive selected message |
| `u` | Mark as unread |
| `d` | Show directory panel |
| `Tab` | Switch between inbox / sent / search modes |
| `f` | Filter panel (by sender, date range) |
| `t` | Toggle threaded / flat view |
| `?` or `F1` | Show help |
| `q` or `Ctrl+C` | Quit |

#### Modes

1. **Inbox mode** (default): Shows messages addressed to the user.
   Threaded or flat, unread-first by default.

2. **Sent mode** (`Tab`): Shows messages sent by the user.

3. **Search mode** (`/` then Enter): Semantic search results ranked
   by similarity.

4. **Directory mode** (`d`): Browse and manage directory entries.

5. **Thread view** (`Enter` on a threaded message): Expands to show
   the full conversation thread inline.

---

## 8. Configuration

### 8.1 Environment Variables

**API Server** (requires database + OpenAI access):

| Variable | Required | Description |
|---|---|---|
| `ESHU_PROJECT_ID` | yes | Project identifier (e.g., `"acme-platform"`) |
| `ESHU_DATABASE_URL` | yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | yes | OpenAI API key for embeddings |
| `ESHU_API_PORT` | no | Port to listen on (default: `3100`) |
| `ESHU_API_KEY` | no | If set, all requests require `Authorization: Bearer` |
| `ESHU_EMBEDDING_MODEL` | no | Embedding model (default: `text-embedding-3-small`) |
| `ESHU_SEARCH_THRESHOLD` | no | Min similarity for search results (default: `0.25`) |
| `ESHU_SEARCH_LIMIT` | no | Default search result limit (default: `20`) |

**Clients** (MCP server, CLI — connect to the REST API):

| Variable | Required | Description |
|---|---|---|
| `ESHU_PROJECT_ID` | yes | Project identifier |
| `ESHU_API_URL` | yes | REST API base URL (e.g., `http://localhost:3100/api/v1`) |
| `ESHU_API_KEY` | no | API key if the server requires authentication |
| `ESHU_AGENT_ADDRESS` | yes* | Agent address for MCP server (e.g., `"alice/code-reviewer"`) |
| `ESHU_USER_ADDRESS` | yes* | Human address for CLI/TUI (e.g., `"alice"`) |

\* `ESHU_AGENT_ADDRESS` is required for the MCP server.
`ESHU_USER_ADDRESS` is required for the CLI/TUI.

### 8.2 Config File

Both the MCP server and CLI read `~/.eshu/config.json` as a fallback.
Environment variables take precedence.

```json
{
    "project_id": "acme-platform",
    "api_url": "http://localhost:3100/api/v1",
    "api_key": "optional-api-key",
    "user_address": "alice",
    "embedding_model": "text-embedding-3-small",
    "search_threshold": 0.25,
    "search_limit": 20
}
```

---

## 9. Project Structure

```
eshu/
├── packages/
│   ├── shared/              # Core library (config, db, identity, types)
│   │   ├── src/
│   │   │   ├── config.ts    # Config loading (env + file)
│   │   │   ├── db.ts        # PostgreSQL client + queries
│   │   │   ├── embeddings.ts # Embedding generation
│   │   │   ├── identity.ts  # Address parsing
│   │   │   ├── types.ts     # Shared types
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api-server/          # Hono REST API server
│   │   ├── src/
│   │   │   ├── app.ts       # Hono app factory
│   │   │   ├── handlers/
│   │   │   │   ├── directory.ts
│   │   │   │   ├── inbox.ts
│   │   │   │   ├── read.ts
│   │   │   │   ├── search.ts
│   │   │   │   ├── send.ts
│   │   │   │   └── stats.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── identity.ts
│   │   │   │   └── error-handler.ts
│   │   │   ├── routes/
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api-client/          # HTTP client for the REST API
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── errors.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── mcp-server/          # MCP server for agents
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── tools/
│   │   │   │   ├── archive-message.ts
│   │   │   │   ├── directory.ts
│   │   │   │   ├── inbox.ts
│   │   │   │   ├── read-message.ts
│   │   │   │   ├── search-messages.ts
│   │   │   │   └── send-message.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── cli/                 # CLI / TUI for humans
│       ├── src/
│       │   ├── commands/
│       │   │   ├── inbox.ts
│       │   │   ├── read.ts
│       │   │   ├── reply.ts
│       │   │   ├── send.ts
│       │   │   ├── search.ts
│       │   │   ├── archive.ts
│       │   │   ├── directory.ts
│       │   │   └── stats.ts
│       │   ├── tui/
│       │   │   ├── App.tsx
│       │   │   ├── components/
│       │   │   └── context.tsx
│       │   └── index.ts
│       └── package.json
│
├── agent-skills/
│   ├── eshu-messaging-mcp/  # Skill: use Eshu via MCP tools
│   └── eshu-messaging-cli/  # Skill: use Eshu via CLI commands
│
├── supabase/
│   └── migrations/
│       ├── 001_create_directory_entry.sql
│       ├── 002_create_message.sql
│       ├── 003_create_mailbox_entry.sql
│       ├── 004_create_message_recipient.sql
│       ├── 005_create_indexes.sql
│       └── 006_create_functions.sql
│
├── Dockerfile
├── docker-compose.yml
├── package.json             # Bun workspace root
├── tsconfig.json
├── biome.json
├── SPEC.md                  # This file
└── TODO.md                  # Phased build plan
```

### npm Packages

| Package | npm name | Binary | Description |
|---|---|---|---|
| `packages/cli` | `@eshu/cli` | `eshu` | CLI/TUI for human messaging |
| `packages/mcp-server` | `@eshu/mcp-server` | `eshu-mcp-server` | MCP server for AI agents |

### Internal Packages (bundled, not published)

| Package | Used by | Purpose |
|---|---|---|
| `packages/shared` | `api-server` | Config, DB, embeddings, types |
| `packages/api-client` | `mcp-server`, `cli` | HTTP client for REST API |

---

## 10. Sizing & Operational Notes

### Expected Scale

- **Messages:** Hundreds per project per day in active use. Each
  message is a short communication (typically < 5000 chars). This is
  comfortably within PostgreSQL's capabilities.
- **Threads:** Tens of active threads at any time. Thread
  reconstruction (fetching all messages by `thread_id`) is a simple
  indexed query.
- **Directory:** Tens of entries per project. Fully cacheable.
- **Search:** pgvector HNSW index handles thousands of messages
  easily. The search workload is lighter than Moneta's because
  messaging search is less frequent than memory recall.
- **Embedding API calls:** One per `send_message` call. At
  `text-embedding-3-small` pricing, this is negligible.

### Monitoring

Track these metrics:

1. **Message volume:** Daily sent/received counts per participant.
2. **Unread backlog:** Messages sitting unread for > 24h may indicate
   an agent isn't checking its inbox (skill misconfiguration).
3. **Thread depth:** Very long threads (> 20 messages) may indicate
   agents looping or failing to resolve issues.
4. **Receipt fulfillment:** Receipt-requested messages where not all
   recipients have read receipts after > 24h.
5. **Directory coverage:** Agents sending messages that reference
   addresses not in the directory (validation errors).

---

## 11. Future Considerations

These are explicitly out of scope for v1 but worth tracking:

1. **Agent self-registration.** Allow agents to register themselves
   in the directory on first connection to the MCP server. Humans
   could then edit descriptions/expectations via TUI. This moves
   from admin-only to a mixed model.

2. **Groups / mailing lists.** A `team:backend` address that expands
   to all backend team members. Requires a `directory_group` table
   with membership.

3. **Push notifications.** Webhook endpoint that fires when a message
   arrives for a recipient. Useful for integrating with external
   alerting (Slack, PagerDuty) for human recipients.

4. **Attachments.** Support file references (URLs, not inline blobs)
   attached to messages. Agents could share log files, screenshots,
   PR diffs.

5. **Priority levels.** Urgent/normal/low priority on messages. Inbox
   sorts by priority first, then chronologically. Agents sending to
   humans could use priority to signal importance.

6. **Message templates.** Pre-defined message templates for common
   communications (status updates, blockers, review requests). Reduces
   the overhead of composing well-structured messages.

7. **Cross-project messaging.** Federation between Eshu instances on
   different projects. A `project:auth-service/auto/ci-fixer` address
   format that routes to a different API endpoint.

8. **Conversation summarization.** For long threads, auto-generate a
   summary of the conversation so far. Useful for humans joining a
   thread late or agents needing context without reading 20 messages.

9. **Message reactions.** Lightweight acknowledgment without a full
   reply. `👍`, `✅`, `🔍` could signal "acknowledged", "done",
   "investigating" without adding noise to the thread.

10. **Delivery guarantees.** Track whether a message was successfully
    delivered (mailbox entry created) vs. failed (recipient not in
    directory, API error). Retry logic for transient failures.
