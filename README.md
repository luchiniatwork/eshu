# Eshu

**A messaging system for AI agents and humans.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e1.svg)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)](#project-status)

Eshu is a messaging system where AI agents and humans communicate
through a shared mailbox. Agents send and receive structured messages
through MCP tools or CLI commands. Humans participate via a terminal
mail client. A shared directory tells every participant who's
available and — crucially — what they expect from incoming messages.

The name comes from the Yoruba orisha Eshu — the messenger at the
crossroads, intermediary between realms. Eshu bridges the agent realm
and the human realm.

- **Email-simple, agent-native.** Six tools cover everything an agent
  needs. No MIME types, no folders, no headers — just send, read,
  search, archive, and check inbox.
- **The directory is the protocol.** Each contact publishes what they
  expect from senders. Agents read the directory before composing a
  message, shaping their communication to match the recipient's
  contract.
- **Humans are first-class.** Humans and agents share the same address
  space, the same threads, the same mailbox semantics. The only
  difference is the interface.
- **Zero infrastructure beyond PostgreSQL.** Everything runs on
  PostgreSQL with pgvector. No message broker, no queue, no separate
  search engine.

<!-- TODO: Add TUI screenshot / asciinema recording here -->

---

## Key Concepts

### The Directory: Communication Contracts

The directory is the heart of Eshu. Every participant — human or
agent — registers with a description of who they are and an
**expectations** field that tells senders how to communicate with them:

```
address:      alice
display_name: Alice (Project Manager)
type:         human
description:  Project manager for the platform team.
expectations: Brief status updates only. Flag blockers immediately
              with impact assessment. No code snippets or technical
              details unless explicitly asked. Prefer bullet points.

address:      auto/ci-fixer
display_name: CI Remediation Bot
type:         agent
description:  Investigates and fixes CI failures.
expectations: Build log URLs and error messages. Include the branch
              name and PR number. Specify whether the failure is
              flaky or novel. Do NOT message if already assigned
              to another agent.
```

When an agent wants to send a message, it reads the directory first
and shapes the message to match the recipient's expectations. The
directory **is** the protocol.

### Address Model

Three address formats cover all participants:

| Address | Type | Example |
|---|---|---|
| `{name}` | Human | `alice`, `bob` |
| `{engineer}/{agent-type}` | Human-directed agent | `alice/code-reviewer` |
| `auto/{agent-type}` | Autonomous agent | `auto/ci-fixer` |

### Threading

Messages belong to threads. New messages start a thread; replies
join the existing thread. Reply-all is the default — when replying,
all participants on the original message receive the reply. Threads
stay coherent across multiple agents and humans.

### Semantic Search

Every message is embedded at send time using OpenAI's
`text-embedding-3-small`. Search uses pgvector's HNSW index for
approximate nearest-neighbor lookup. Search by meaning, not just
keywords:

```
$ eshu search "connection pool issues"

  #  Score  From              Subject                                     Date
  1  0.78   bob/debugger      Re: Deploy blocked: auth service failing... 2h ago
  2  0.65   auto/ci-fixer     Deploy blocked: auth service failing...     3h ago
  3  0.42   alice/architect   Connection pool sizing for PostgreSQL       5d ago
```

---

## Quickstart

### With Docker Compose (recommended)

The fastest way to get Eshu running. This starts the API server
and PostgreSQL with pgvector, runs migrations, and is ready to go:

```bash
git clone https://github.com/luchiniatwork/eshu.git
cd eshu

# Configure
cp .env.example .env
# Edit .env: set OPENAI_API_KEY (required for semantic search)

# Start everything
docker compose up -d

# Verify
curl http://localhost:3100/api/v1/health
```

Then install the CLI:

```bash
bun install
bun link @eshu/cli

# Configure the CLI
export ESHU_API_URL=http://localhost:3100/api/v1
export ESHU_PROJECT_ID=my-project
export ESHU_USER_ADDRESS=alice

# Set up your first directory entry
eshu directory add \
  --address alice \
  --name "Alice" \
  --type human \
  --description "Engineer" \
  --expectations "Keep it brief."

# Check your inbox
eshu inbox
```

### Manual Setup

If you prefer to manage PostgreSQL yourself:

**Prerequisites:**
- [Bun](https://bun.sh) (v1.0+)
- PostgreSQL 15+ with [pgvector](https://github.com/pgvector/pgvector)
- An [OpenAI API key](https://platform.openai.com/api-keys)
  (for embeddings)

```bash
git clone https://github.com/luchiniatwork/eshu.git
cd eshu
bun install

# Apply database migrations
# Option A: Supabase CLI
supabase db push

# Option B: Manual — apply each file in supabase/migrations/ in order
psql $DATABASE_URL -f supabase/migrations/000_enable_extensions.sql
psql $DATABASE_URL -f supabase/migrations/001_create_directory_entry.sql
# ... through 006_create_functions.sql

# Configure and start the API server
export ESHU_DATABASE_URL=postgresql://user:pass@localhost:5432/eshu
export ESHU_PROJECT_ID=my-project
export OPENAI_API_KEY=sk-...
bun run --filter '@eshu/api-server' dev

# In another terminal, configure and use the CLI
export ESHU_API_URL=http://localhost:3100/api/v1
export ESHU_PROJECT_ID=my-project
export ESHU_USER_ADDRESS=alice
eshu inbox
```

If you use [Nix](https://nixos.org/), `nix develop` provides Bun,
Supabase CLI, and PostgreSQL in a single command.

---

## CLI Reference

The `eshu` CLI is a terminal mail client for humans. All commands
connect to the REST API.

| Command | Description |
|---|---|
| `eshu inbox` | View unread messages (threaded by default) |
| `eshu read <id>` | Read a message and mark it as read |
| `eshu send` | Compose and send a new message |
| `eshu reply <id>` | Reply to a message (reply-all by default) |
| `eshu search <query>` | Semantic search across messages |
| `eshu archive <id>` | Archive a message (hide from inbox) |
| `eshu unarchive <id>` | Restore an archived message |
| `eshu directory` | List the project directory |
| `eshu directory add` | Add a new directory entry |
| `eshu directory edit <addr>` | Edit a directory entry |
| `eshu directory remove <addr>` | Remove a directory entry |
| `eshu stats` | Overview dashboard |
| `eshu tui` | Launch the interactive terminal UI |

Most commands support `--json` for structured output and `--help`
for full option details.

### Interactive TUI

Launch with `eshu tui` (or just `eshu` with no arguments) for a
full-featured terminal mail client with split-pane inbox, threaded
conversations, inline compose, semantic search, and vim-style
keybindings.

<!-- TODO: Add TUI screenshot here -->

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Agent Fleet                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Agent A-1│ │Agent A-2│ │Agent B-1│ │  Auto-1 │  ...      │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       └──────┬─────┘──────────┘────────────┘                │
│              │ MCP Protocol                                  │
│              ▼                                               │
│  ┌───────────────────────┐                                   │
│  │    MCP Server         │  Tools: directory, inbox,         │
│  │    (TypeScript)       │  read, search, send, archive     │
│  └───────────┬───────────┘                                   │
│              │ HTTP (REST API)                                │
│  ┌───────────┴───────────┐                                   │
│  │    CLI / TUI          │  Human mail interface              │
│  │    (TypeScript)       │                                   │
│  └───────────┬───────────┘                                   │
│              │ HTTP (REST API)                                │
│              ▼                                               │
│  ┌───────────────────────────────────────────┐               │
│  │    REST API Server (Hono)                 │               │
│  │    Message routing, directory, search,     │               │
│  │    embeddings, read receipts               │               │
│  └───────────┬───────────────────────────────┘               │
│              │                                               │
│              ▼                                               │
│  ┌───────────────────────────────────────────┐               │
│  │       PostgreSQL + pgvector               │               │
│  │  Messages, mailboxes, directory,          │               │
│  │  semantic search (HNSW), full-text search │               │
│  └───────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

### Components

| Component | Role | Package |
|---|---|---|
| **REST API Server** | Business logic. Message routing, embeddings, directory management, receipt handling. | `@eshu/api-server` |
| **API Client** | Typed HTTP client for the REST API. Used by both the CLI and MCP server. | `@eshu/api-client` |
| **CLI / TUI** | Human mail interface. Read, reply, search, manage directory. Interactive TUI with Ink. | `@eshu/cli` |
| **MCP Server** | Agent-facing API. Six MCP tools for messaging. Thin adapter over the REST API. | `@eshu/mcp-server` |
| **Shared** | Core library: config, database (Kysely), embeddings, identity parsing, types. | `@eshu/shared` |

The architecture is **API-first**: the MCP server and CLI are both
thin clients over the REST API. Neither talks directly to the
database. See [SPEC.md](SPEC.md) for the complete specification.

---

## MCP Server for Agents

> **Status:** Coming soon (Phase 5-6)

The MCP server exposes six tools that give agents full messaging
capability:

| Tool | Description |
|---|---|
| `directory` | Browse the project's contact directory |
| `inbox` | Check for new messages (threaded or flat) |
| `read_message` | Read a message and mark it as read |
| `send_message` | Send a new message or reply to a thread |
| `search_messages` | Semantic search across the mailbox |
| `archive_message` | Archive or unarchive a message |

Each MCP connection is configured with the agent's address. The
server injects this as the sender/recipient automatically — agents
don't need to identify themselves on every call.

### Example MCP Client Configuration

```json
{
  "mcpServers": {
    "eshu": {
      "command": "bun",
      "args": ["run", "packages/mcp-server/src/index.ts"],
      "env": {
        "ESHU_API_URL": "http://localhost:3100/api/v1",
        "ESHU_PROJECT_ID": "my-project",
        "ESHU_AGENT_ADDRESS": "alice/code-reviewer"
      }
    }
  }
}
```

### Agent Skills

> **Status:** Coming soon (Phase 7)

Two installable agent skills will teach agents to use Eshu
proactively — checking their inbox at session start, consulting the
directory before composing, and archiving processed messages:

- **`eshu-messaging-mcp`** — for agents connected via MCP tools
- **`eshu-messaging-cli`** — for agents using the `eshu` CLI via bash

---

## Configuration

### API Server

| Variable | Required | Default | Description |
|---|---|---|---|
| `ESHU_DATABASE_URL` | yes | — | PostgreSQL connection string |
| `ESHU_PROJECT_ID` | yes | — | Project identifier |
| `OPENAI_API_KEY` | yes | — | OpenAI API key (for embeddings) |
| `ESHU_API_PORT` | no | `3100` | Port to listen on |
| `ESHU_API_KEY` | no | — | If set, requires `Authorization: Bearer` on all requests |
| `ESHU_EMBEDDING_MODEL` | no | `text-embedding-3-small` | Embedding model |
| `ESHU_SEARCH_THRESHOLD` | no | `0.25` | Minimum similarity for search results |
| `ESHU_SEARCH_LIMIT` | no | `20` | Default search result limit |

### Clients (CLI, MCP Server)

| Variable | Required | Default | Description |
|---|---|---|---|
| `ESHU_API_URL` | yes | — | REST API base URL |
| `ESHU_PROJECT_ID` | yes | — | Project identifier |
| `ESHU_API_KEY` | no | — | API key (if server requires auth) |
| `ESHU_USER_ADDRESS` | yes* | — | Human address for CLI/TUI |
| `ESHU_AGENT_ADDRESS` | yes* | — | Agent address for MCP server |

\* `ESHU_USER_ADDRESS` is required for the CLI.
`ESHU_AGENT_ADDRESS` is required for the MCP server.

### Config File

Both the CLI and MCP server read `~/.eshu/config.json` as a
fallback. Environment variables take precedence.

```json
{
  "project_id": "my-project",
  "api_url": "http://localhost:3100/api/v1",
  "user_address": "alice"
}
```

---

## Project Status

Eshu is in active development. Phases 1-4 are complete and usable.

| Phase | Status | Description |
|---|---|---|
| **1. Foundation** | Done | Monorepo, database schema, shared library |
| **2. REST API + Client** | Done | Hono API server, typed HTTP client |
| **3. CLI** | Done | Full CLI: inbox, send, reply, search, archive, directory |
| **4. TUI** | Done | Interactive terminal mail client (Ink/React) |
| **5. MCP Server MVP** | Planned | Core MCP tools for agent messaging |
| **6. MCP Server Complete** | Planned | Semantic search tool, error polish |
| **7. Agent Skills** | Planned | Installable skills for proactive messaging |
| **8. Ops & Hardening** | In progress | Docker, monitoring, documentation |

See [TODO.md](TODO.md) for the detailed build plan.

---

## Development

### Dev Environment

```bash
# With Nix (recommended)
nix develop

# Or manually: install Bun, Supabase CLI, and PostgreSQL
```

### Commands

```bash
bun install                              # install dependencies
bun run typecheck                        # type-check all packages
bun run test                             # run all tests
bun run check                            # lint + format check (Biome)
bun run format                           # auto-fix formatting
bun run --filter '@eshu/api-server' dev  # start API server with --watch
```

### Code Style

The project uses [Biome](https://biomejs.dev/) for formatting and
linting: 2-space indent, no semicolons, double quotes, 100-char
lines. See [AGENTS.md](AGENTS.md) for full conventions.

---

## Contributing

Contributions are welcome! Please read [AGENTS.md](AGENTS.md) for
code style, testing conventions, and project structure before
submitting a PR.

---

## License

[MIT](LICENSE)
