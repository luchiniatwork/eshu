# Eshu — Build Plan

Phased build plan for the system described in [SPEC.md](./SPEC.md).
Each phase produces a usable increment. Phases are sequential — each
depends on the previous — but tasks within a phase can be parallelized
where noted.

Estimated total: **~9.5 working days** for a single engineer.

### Build order rationale

The CLI and TUI are built **before** the MCP server. This is
deliberate: humans dogfood the messaging system first, validating the
data model, directory design, and message lifecycle with human
judgment before agents start using it. The REST API (Phase 2) is the
shared backbone — both CLI and MCP are thin clients over it, so
building the CLI first doesn't create throwaway work.

---

## Phase 1: Foundation

> **Goal:** Monorepo scaffolding, database schema deployed, shared
> library compiles. Nothing runs yet, but the ground is laid.
>
> **Estimate:** 1 day
>
> **Done when:** `bun run typecheck` succeeds across all packages,
> migrations apply cleanly, embedding generation returns a vector
> from a test string.

### Project scaffolding

- [x] Create monorepo root with `package.json` (bun workspaces)
- [x] Create root `tsconfig.json` with shared compiler options
- [x] Create all package directories with `package.json` and
      `tsconfig.json`: `shared`, `api-server`, `api-client`,
      `mcp-server`, `cli`
- [x] Add `biome.json` with Moneta's formatting rules (2-space
      indent, no semicolons, double quotes, 100-char width)
- [x] Add shared dev dependencies: `typescript`, `@biomejs/biome`,
      `@types/bun`, `supabase`
- [x] Add `flake.nix` for reproducible dev environment (Bun,
      Supabase CLI, PostgreSQL)
- [x] Add `.gitignore`, `.dockerignore`

### Database

- [x] Create `supabase/migrations/000_enable_extensions.sql`
      — pgvector extension
- [x] Create `supabase/migrations/001_create_directory_entry.sql`
      — table DDL from SPEC section 3.1
- [x] Create `supabase/migrations/002_create_message.sql`
      — table DDL from SPEC section 3.2
- [x] Create `supabase/migrations/003_create_mailbox_entry.sql`
      — table DDL from SPEC section 3.3
- [x] Create `supabase/migrations/004_create_message_recipient.sql`
      — table DDL from SPEC section 3.4
- [x] Create `supabase/migrations/005_create_indexes.sql`
      — all indexes from SPEC section 3.5
- [x] Create `supabase/migrations/006_create_functions.sql`
      — `search_messages()` function from SPEC section 3.6
- [x] Apply migrations to a dev Supabase instance and verify with
      manual INSERT + SELECT round-trip

### Shared library (`packages/shared`)

- [x] `types.ts` — All domain types: `DirectoryEntry`, `Message`,
      `MailboxEntry`, `MessageRecipient`, `SearchResult`, `Config`,
      Kysely table interfaces
- [x] `config.ts` — Load config from env vars → config file →
      defaults (ESHU_* prefix)
- [x] `db.ts` — Kysely + postgres.js client, typed wrappers for
      queries (inbox, send, read, search, directory CRUD, archive)
- [x] `embeddings.ts` — `embed(text, apiKey, model?): Promise<number[]>`
      (reuse Moneta's approach)
- [x] `identity.ts` — `parseAddress()` decomposition (address →
      type, engineer, agentType)
- [x] `index.ts` — barrel export
- [x] Unit tests for config loading, identity parsing, embedding
      generation

---

## Phase 2: REST API Server + API Client

> **Goal:** The API server handles all business logic. The API client
> provides a typed HTTP interface. This is the backbone that both the
> CLI and MCP server build on.
>
> **Estimate:** 2 days
>
> **Done when:** API server starts, handles all endpoints, API client
> can perform all operations in integration tests.

### API Server (`packages/api-server`)

- [x] `app.ts` — Hono app factory with middleware stack
- [x] Middleware: `auth.ts` (Bearer token), `identity.ts` (extract
      agent/user address from header), `error-handler.ts`
- [x] `types.ts` — Zod schemas for all request/response types
- [x] Routes and handlers:
  - [x] `POST /api/v1/directory` — List directory (with optional
        type filter)
  - [x] `POST /api/v1/directory/add` — Add directory entry
  - [x] `PUT /api/v1/directory/:address` — Update directory entry
  - [x] `DELETE /api/v1/directory/:address` — Remove directory entry
  - [x] `POST /api/v1/inbox` — Get inbox (threaded/flat, unread
        filter, pagination)
  - [x] `POST /api/v1/messages/:id/read` — Read a message (mark
        read, trigger receipt if needed)
  - [x] `POST /api/v1/messages/:id/archive` — Archive a message
  - [x] `POST /api/v1/messages/:id/unarchive` — Unarchive a message
  - [x] `POST /api/v1/messages/search` — Semantic search
  - [x] `POST /api/v1/messages/send` — Send a message (new or reply)
  - [x] `GET /api/v1/messages/:id/thread` — Get full thread
  - [x] `GET /api/v1/stats` — Messaging statistics
  - [x] `GET /api/v1/health` — Health check
- [x] Receipt handling logic: on first read of a receipt-requested
      message, auto-create receipt message in thread
- [x] Reply-all resolution: compute default recipients from parent
      message
- [x] Embedding generation on send
- [x] Handler unit tests

### API Client (`packages/api-client`)

- [x] `types.ts` — Client-side type definitions (camelCase API
      contract)
- [x] `client.ts` — `createClient()` factory with all methods:
      `directory()`, `inbox()`, `readMessage()`,
      `searchMessages()`, `sendMessage()`, `archiveMessage()`,
      `unarchiveMessage()`, `addDirectoryEntry()`, etc.
- [x] `errors.ts` — `ApiError` class
- [x] Client unit tests

---

## Phase 3: CLI — Read + Write + Directory

> **Goal:** Humans can fully participate in messaging from the
> terminal. This is the first dogfooding interface — humans validate
> the messaging model before agents start using it.
>
> **Estimate:** 1.5 days
>
> **Done when:** All CLI commands work. A human can browse the
> directory, send messages, check inbox, read and reply to messages,
> search, archive, and manage directory entries. Output matches the
> mockups in SPEC section 7.2.

### CLI scaffolding

- [x] `packages/cli/src/index.ts` — entry point, Commander arg
      parser
- [x] Config loading: reuse shared config module
- [x] Output formatting helpers (table renderer, colors, --json
      support)
- [x] Short ID display: show first 8 chars of UUID, accept prefix
      match (local cache at `~/.eshu/.id-cache`)
- [x] Unit tests for format, id-cache, and editor utilities

### Read commands

- [x] `eshu inbox` — inbox view (threaded/flat, unread filter)
- [x] `eshu read <id>` — read a message, show full content
- [x] `eshu search <query>` — semantic search with tabular output
- [x] `eshu directory` — list directory entries
- [x] `eshu stats` — aggregate dashboard

### Write commands

- [x] `eshu send` — compose and send a new message (with $EDITOR
      support)
- [x] `eshu reply <id>` — reply to a message (reply-all default,
      `--to` to override recipients)
- [x] `eshu archive <id>` / `eshu unarchive <id>` — archive
      management

### Directory management

- [x] `eshu directory add` — add a new directory entry
- [x] `eshu directory edit <address>` — edit entry (opens $EDITOR)
- [x] `eshu directory remove <address>` — remove entry with
      confirmation

### Smoke test

- [x] Manual end-to-end: set up directory, send messages between
      two human addresses, verify inbox, read, reply, archive
- [x] Verify threading: send, reply, reply again — confirm thread
      reconstruction
- [x] Verify read receipts: send with `--receipt`, read from other
      address, confirm receipt appears in sender's thread
- [x] Verify search: send several messages, search by query, confirm
      semantic ranking

---

## Phase 4: TUI

> **Goal:** Interactive terminal mail client for humans. This is the
> "power user" daily-driver interface.
>
> **Estimate:** 2 days
>
> **Done when:** `eshu tui` launches an interactive interface with
> inbox, sent, search, and directory modes. All keybindings from
> SPEC section 7.3 work. Feature parity with the CLI commands.

### Framework setup

- [x] Choose TUI framework — **Ink v7** (React 18, ESM)
- [x] Basic app shell: header bar (project, user, unread count),
      footer bar (keybindings), main content area
- [x] React context for config + API client

### Inbox mode (default)

- [x] Message list (left panel): unread indicator, sender, subject,
      time, thread info
- [x] Message detail (right panel): full headers, body, thread
      context
- [x] `j`/`k` or arrow keys to navigate
- [x] Enter to open/expand thread
- [x] Threaded/flat toggle (`t`)
- [x] Archive action (`a`)

### Compose / Reply

- [x] `r` to reply ($EDITOR) and `R` for inline quick reply
- [x] `c` to compose new message
- [x] Recipient picker from directory (address list in $EDITOR
      template)
- [x] Receipt request toggle

### Sent mode

- [x] `Tab` to switch to sent messages
- [x] Same list/detail layout, sorted by sent date

### Search mode

- [x] `/` to focus search bar, Enter to search
- [x] Results ranked by similarity
- [x] Navigate and read results

### Directory mode

- [x] `d` to open directory panel
- [x] Browse entries with descriptions and expectations
- [x] Add/edit/remove entries (via $EDITOR)

### Polish

- [x] Responsive layout (adapt to terminal size)
- [x] Loading indicators for API calls
- [x] Error display (non-crashing, auto-dismiss after 5s)
- [x] Help overlay (`?` / `F1`)

### API gaps filled (pre-work for TUI)

- [x] `POST /api/v1/sent` — sent messages endpoint (DB function
      existed, added route + handler + client method)
- [x] `POST /api/v1/messages/:id/unread` — mark as unread endpoint
      (added `markAsUnread` to db.ts, handler, client method)
- [x] Auto-refresh inbox every 30s + manual refresh (`g` key)

---

## Phase 5: MCP Server MVP

> **Goal:** Agents can browse the directory, send messages, check
> their inbox, read messages, and archive. This is the minimum
> viable product for agent-to-agent communication. Feature parity
> with the CLI (except admin-only directory management).
>
> **Estimate:** 1 day
>
> **Done when:** An MCP client can connect, browse the directory, send
> a message, check inbox, read the message, and archive it. Threading
> and receipts work.

### Server setup

- [ ] `server.ts` — MCP server scaffolding using
      `@modelcontextprotocol/sdk` with stdio transport
- [ ] Read `ESHU_AGENT_ADDRESS` and `ESHU_PROJECT_ID` from config
- [ ] Server instructions describing the messaging system and
      available tools

### Core tools (parity with CLI)

- [ ] `tools/directory.ts` — Browse directory with optional type
      filter (≈ `eshu directory`)
- [ ] `tools/inbox.ts` — Check inbox (threaded/flat, unread filter)
      (≈ `eshu inbox`)
- [ ] `tools/read-message.ts` — Read a message, mark as read,
      optionally include thread (≈ `eshu read`)
- [ ] `tools/send-message.ts` — Send new message or reply to
      existing thread (≈ `eshu send` + `eshu reply`)
- [ ] `tools/archive-message.ts` — Archive or unarchive a message
      (≈ `eshu archive` + `eshu unarchive`)

### Smoke test

- [ ] Manual end-to-end: connect two MCP clients as different
      agents, send messages between them, verify delivery and
      threading
- [ ] Verify reply-all: reply to a multi-recipient message, confirm
      all recipients get the reply
- [ ] Verify read receipts: send with receipt_requested, read from
      other agent, verify receipt appears in sender's thread
- [ ] Verify archive: agent archives a processed message, confirm
      it no longer appears in inbox

---

## Phase 6: MCP Server Complete

> **Goal:** All MCP tools operational including semantic search.
> Full feature parity with CLI. Ready for multi-agent deployment.
>
> **Estimate:** 0.5 day
>
> **Done when:** All tools work, search returns semantically relevant
> results, error cases return clear messages.

### Search tool

- [ ] `tools/search-messages.ts` — Semantic search with folder
      filter and similarity ranking (≈ `eshu search`)

### Polish

- [ ] Error handling for all edge cases (unknown recipient, message
      not found, empty body, etc.)
- [ ] Structured logging (JSON to stderr) for all tool invocations
- [ ] Integration test: full lifecycle — directory browse → send →
      inbox → read → search → reply → archive

---

## Phase 7: Agent Skills

> **Goal:** Installable agent skills that teach AI coding agents to
> use Eshu proactively — checking inbox at session start, sending
> messages when appropriate. Two skills: one for agents using the
> MCP tools, one for agents using the CLI via bash.
>
> **Estimate:** 0.5 day
>
> **Done when:** Both skills can be installed via `npx skills add` and
> agents automatically check their inbox at session start regardless
> of interface (MCP or CLI).

### MCP skill

- [ ] `agent-skills/eshu-messaging-mcp/SKILL.md` — skill for agents
      that connect to the Eshu MCP server:
  - [ ] Check inbox at session start
  - [ ] Read and respond to unread messages
  - [ ] Consult directory before sending (read expectations)
  - [ ] Archive processed messages
  - [ ] Use `search_messages` to find prior conversation context
  - [ ] Guidance on message composition (respect expectations)
  - [ ] Guidance on when messaging is appropriate vs. not

### CLI skill

- [ ] `agent-skills/eshu-messaging-cli/SKILL.md` — skill for agents
      that use the `eshu` CLI via bash commands:
  - [ ] Same behavioral guidance as the MCP skill
  - [ ] Maps each behavior to the equivalent CLI command
  - [ ] `eshu inbox` at session start
  - [ ] `eshu read <id>` for unread messages
  - [ ] `eshu directory` before composing
  - [ ] `eshu send` / `eshu reply` for sending
  - [ ] `eshu archive` after processing
  - [ ] `eshu search` for prior context
  - [ ] Includes `--json` flag usage for structured parsing

---

## Phase 8: Ops & Hardening

> **Goal:** Production-ready. Monitoring in place, deployment
> documented.
>
> **Estimate:** 1 day
>
> **Done when:** Docker deployment works, monitoring queries exist,
> a new engineer can set up the system from the README alone.

### Docker

- [x] `Dockerfile` — multi-stage Bun build (install + slim
      runtime), health check via `/api/v1/health`
- [x] `docker-compose.yml` — three services: `db`
      (pgvector/pgvector:pg16), `migrate` (idempotent migration
      runner), `api` (built from Dockerfile). README quickstart
      leads with this.
- [x] `.dockerignore` — excludes node_modules, .git, .jj, .env,
      scripts, monitoring
- [x] `.env.example` — template env file for Docker Compose
      quickstart (referenced by README)
- [x] `scripts/migrate.sh` — idempotent migration runner with
      `_applied_migrations` tracking table. Waits for PostgreSQL,
      applies new migrations, skips already-applied ones.
- [x] Verify full stack starts and handles messages end-to-end
      (directory add → send → inbox round-trip confirmed)
- [x] Verify migration idempotency (restart skips all 7 migrations)

### Documentation

- [x] `README.md` — project overview, key concepts, quickstart
      (Docker Compose + manual), CLI reference, architecture
      diagram, MCP preview, configuration, project status
- [x] `AGENTS.md` — code style guidelines, build commands, testing
      conventions
- [x] `LICENSE` — MIT license
- [ ] MCP client configuration examples (Claude, Cursor, OpenCode)
      — README has a generic example; add tool-specific configs
      once the MCP server is built (Phase 5-6)
- [ ] Agent prompt guidance: how to use the directory effectively,
      when to check inbox, message composition best practices

### Visual assets

- [x] `scripts/seed.ts` — demo seed data script (4 directory
      entries, 3 threads, 6 messages with realistic content).
      Run with `bun run scripts/seed.ts` against a running API.
- [ ] Capture TUI screenshot for README hero image (run seed
      script first, then `eshu tui` as alice)
- [ ] Record asciinema demo of CLI workflow (directory → send →
      inbox → read → reply → search) for README
- [ ] Update README to embed the screenshot and recording once
      captured

### Monitoring

- [x] `monitoring/queries.sql` — all 5 operational queries from
      SPEC section 10: message volume, unread backlog, thread
      depth, receipt fulfillment, directory coverage.
      Parameterized by project_id for psql usage.
- [ ] Verify embedding generation works reliably under load

---

## Phase Dependencies

```
Phase 1: Foundation
    │
    ▼
Phase 2: REST API + API Client
    │
    ├────────────────────────────────┐
    ▼                                ▼
Phase 3: CLI  ◄── dogfood       Phase 5: MCP Server MVP
    │             with humans        │
    ▼                                ▼
Phase 4: TUI  ◄── daily         Phase 6: MCP Server Complete
    │             driver for         │    ◄── roll out to
    │             humans             │        agent fleet
    └────────────┬───────────────────┘
                 ▼
          Phase 7: Agent Skills (requires both CLI + MCP)
                 │
                 ▼
          Phase 8: Ops & Hardening
```

**Critical path (human-first):** Phases 1 → 2 → 3 → 4 (6.5 days
to full human messaging with TUI).

**Critical path (agents):** Phases 1 → 2 → 5 → 6 (4.5 days to full
agent messaging with search).

**Parallelizable:** Phases 3-4 (CLI/TUI) and Phases 5-6 (MCP) can
be built concurrently by different engineers after Phase 2. However,
the phase numbering reflects priority: humans validate the system
first.

**Skills require both:** Phase 7 depends on both Phase 4 (CLI) and
Phase 6 (MCP) being complete, since it produces skills for both
interfaces.

---

## Dogfooding Milestones

| After Phase | Who Uses It | How |
|---|---|---|
| **3** | 1-2 engineers | CLI for sending messages, reading inbox, managing directory. Validate threading, receipts, search quality with human judgment. |
| **4** | All engineers | TUI as daily-driver mail client. Humans actively participating in conversations. |
| **5** | 2 agents + humans | MCP clients connected. Agents send messages to each other and to humans. Humans reply via CLI/TUI. |
| **6** | Full agent fleet | All agents configured with Eshu. Full messaging between agents and humans. |
| **7** | All agents (proactive) | Agent skills installed. Agents check inbox at session start and message proactively. |

---

## Feature Parity Matrix

Both the CLI and MCP server expose the same core messaging
capabilities through the shared REST API. The table below tracks
parity:

| Capability | CLI Command | MCP Tool | Notes |
|---|---|---|---|
| Browse directory | `eshu directory` | `directory` | Same filters, same data |
| Check inbox | `eshu inbox` | `inbox` | Threaded/flat, unread filter |
| Read a message | `eshu read <id>` | `read_message` | Marks read, triggers receipts |
| Search messages | `eshu search <query>` | `search_messages` | Semantic search, folder filter |
| Send message | `eshu send` | `send_message` | New or reply, receipt request |
| Reply to message | `eshu reply <id>` | `send_message` (in_reply_to) | CLI has dedicated command for ergonomics |
| Archive message | `eshu archive <id>` | `archive_message` | Archive or unarchive |
| Directory management | `eshu directory add/edit/remove` | — | Admin-only, CLI/TUI only |
| Statistics | `eshu stats` | — | Human dashboard, not needed by agents |
| Interactive UI | `eshu tui` | — | Human-only |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Agents over-message** — without guardrails, agents may send excessive messages | High | Medium | Monitor message volume per agent. Add per-agent rate limits in v2 if needed. Agent skills should include guidance on when messaging is appropriate. |
| **Directory staleness** — directory entries become outdated as team changes | Medium | Medium | TUI makes directory browsing/editing easy. Add a `last_active` field in v2 to track which addresses are actually sending/receiving. |
| **Embedding quality for messages** — semantic search on conversational text may be less precise than on factual text (Moneta's domain) | Medium | Low | Messages have subjects which are typically more structured. The combined subject+body embedding should be adequate. Fall back to full-text search if semantic quality is poor. |
| **Thread explosion** — very long threads may degrade inbox readability | Low | Medium | TUI can collapse threads. Add thread summarization in v2 (LLM-generated). |
| **Receipt spam** — multi-recipient messages with receipt_requested generate N receipt messages | Low | Low | Receipts only go to the original sender, not all participants. Still, large recipient lists could generate many receipts. Consider a receipt digest in v2. |
| **CLI/MCP drift** — features added to one interface but not the other | Medium | Medium | Both are thin clients over the same API client. The parity matrix (above) is the checklist. New API endpoints should always get both CLI and MCP exposure. |
