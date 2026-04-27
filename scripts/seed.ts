/**
 * Eshu — Demo seed data
 *
 * Populates the project with realistic directory entries and message
 * threads for screenshots, demos, and exploration.
 *
 * Usage:
 *   ESHU_API_URL=http://localhost:3100/api/v1 \
 *   ESHU_PROJECT_ID=my-project \
 *   bun run scripts/seed.ts
 */

import { createClient } from "@eshu/api-client"

const apiUrl = process.env.ESHU_API_URL ?? ""
if (!apiUrl) {
  console.error("ESHU_API_URL is required")
  process.exit(1)
}

const apiKey = process.env.ESHU_API_KEY

/** Create a client for a specific sender address. */
function client(address: string) {
  return createClient({ apiUrl, address, apiKey })
}

/** Short delay to keep message timestamps visually distinct. */
const pause = (ms = 200) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

console.log("\n--- Setting up directory ---\n")

const entries = [
  {
    address: "alice",
    displayName: "Alice (Project Manager)",
    type: "human" as const,
    description:
      "Project manager for the platform team. Oversees sprint planning, tracks blockers, coordinates cross-team work.",
    expectations:
      "Brief status updates only. Flag blockers immediately with impact assessment. No code snippets or technical details unless explicitly asked. Prefer bullet points. Don't message about routine progress — only exceptions and decisions that need human input.",
  },
  {
    address: "bob",
    displayName: "Bob (Backend Engineer)",
    type: "human" as const,
    description:
      "Backend engineer and auth team lead. Owns the authentication service, connection pooling, and database migrations.",
    expectations:
      "Technical details welcome. Include stack traces and error messages when reporting issues. Mention the affected service and branch. Skip pleasantries — get to the point.",
  },
  {
    address: "auto/ci-fixer",
    displayName: "CI Remediation Bot",
    type: "agent" as const,
    description:
      "Autonomous agent that investigates and fixes CI failures. Monitors build pipelines and can apply automated fixes for known failure patterns.",
    expectations:
      "Build log URLs and error messages. Include the branch name and PR number. Specify whether the failure is flaky (seen before) or novel. Do NOT message if the failure is already assigned to another agent.",
  },
  {
    address: "alice/code-reviewer",
    displayName: "Code Review Bot (Alice)",
    type: "agent" as const,
    description:
      "Automated code review agent. Reviews PRs for style, correctness, and architectural consistency. Runs on every PR targeting main.",
    expectations:
      "Send PR URLs with specific file paths to focus on. Include context about why the change was made and what architectural decisions are relevant. If the PR touches the auth system, mention it explicitly.",
  },
]

const admin = client("alice")

for (const entry of entries) {
  try {
    await admin.addDirectoryEntry(entry)
    console.log(`  + ${entry.address} (${entry.type})`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      console.log(`  ~ ${entry.address} (already exists)`)
    } else {
      throw e
    }
  }
}

// ---------------------------------------------------------------------------
// Thread 1: CI failure investigation
// ---------------------------------------------------------------------------

console.log("\n--- Thread 1: CI failure investigation ---\n")

const ciBot = client("auto/ci-fixer")
const alice = client("alice")
const bob = client("bob")

const t1m1 = await ciBot.sendMessage({
  to: ["alice", "bob"],
  subject: "Deploy blocked: auth service failing health checks",
  body: `Build #4521 failed. Health check endpoint \`/health\` returns 503.

Error from logs:

> Error: Connection pool exhausted. All 10 connections in use.
> Timeout waiting for available connection after 30000ms

Branch: \`feature/token-rotation\`
PR: #342
Failure type: **Novel** — not seen in previous builds.

Attempted automated fix: increased pool size to 20 — build still fails.
Escalating to humans.`,
  receiptRequested: true,
})
console.log(`  + [auto/ci-fixer] ${t1m1.id.slice(0, 8)} — Deploy blocked...`)
await pause()

const t1m2 = await alice.sendMessage({
  body: "This is blocking the release. Can someone investigate?\n\n- Impact: **High** — all deploys paused\n- Timeline: need resolution by EOD",
  inReplyTo: t1m1.id,
})
console.log(`  + [alice] ${t1m2.id.slice(0, 8)} — reply`)
await pause()

const t1m3 = await bob.sendMessage({
  body: `Found the root cause — connection pool exhaustion in the auth service.

The token rotation migration adds a new \`verify_token()\` call that opens a transaction but doesn't release it on the error path. Every failed verification leaks a connection.

Fix: added \`finally { conn.release() }\` in \`packages/auth/src/token.ts:142\`.

PR #347 is up with the fix. CI should pass now.`,
  inReplyTo: t1m2.id,
})
console.log(`  + [bob] ${t1m3.id.slice(0, 8)} — reply with fix`)
await pause()

// ---------------------------------------------------------------------------
// Thread 2: Code review findings
// ---------------------------------------------------------------------------

console.log("\n--- Thread 2: Code review ---\n")

const reviewer = client("alice/code-reviewer")

const t2m1 = await reviewer.sendMessage({
  to: ["bob"],
  subject: "PR #342 review: token rotation — 3 issues found",
  body: `Reviewed PR #342 (\`feature/token-rotation\`). Found 3 issues:

1. **Critical** — \`packages/auth/src/token.ts:142\`: Connection leak on error path. \`verifyToken()\` opens a transaction but the catch block doesn't call \`conn.release()\`. Under load, this exhausts the pool.

2. **Style** — \`packages/auth/src/token.ts:89\`: Magic number \`86400\` should be a named constant (\`TOKEN_TTL_SECONDS\`).

3. **Architecture** — \`packages/auth/src/rotation.ts:34\`: The rotation strategy is hardcoded. Consider extracting to config for per-environment tuning.

Issue #1 is a blocker. #2 and #3 are suggestions.`,
})
console.log(`  + [alice/code-reviewer] ${t2m1.id.slice(0, 8)} — PR review`)
await pause()

const t2m2 = await bob.sendMessage({
  body: `Good catches, especially #1 — that explains the CI failures.

- #1: Fixed in PR #347 (separate fix PR since this is critical)
- #2: Will update — agreed, magic numbers are bad
- #3: Fair point, but deferring to a follow-up. The rotation strategy won't change before launch.`,
  inReplyTo: t2m1.id,
})
console.log(`  + [bob] ${t2m2.id.slice(0, 8)} — reply`)
await pause()

// ---------------------------------------------------------------------------
// Thread 3: Sprint planning (unread for bob)
// ---------------------------------------------------------------------------

console.log("\n--- Thread 3: Sprint planning (unread) ---\n")

const t3m1 = await alice.sendMessage({
  to: ["bob"],
  subject: "Sprint 14 planning — auth team priorities",
  body: `Hey Bob, wanted to align on priorities for next sprint:

- **P0**: Ship token rotation (PR #342 + fix from #347)
- **P1**: Connection pool monitoring dashboard
- **P2**: Refresh token grace period (from last retro)

Can you estimate #P1 and #P2? Need to finalize the sprint by Thursday.`,
})
console.log(`  + [alice] ${t3m1.id.slice(0, 8)} — Sprint planning (unread for bob)`)

// ---------------------------------------------------------------------------
// Read some messages to create realistic read/unread state
// ---------------------------------------------------------------------------

console.log("\n--- Setting read state ---\n")

// Alice reads the CI thread
await alice.readMessage(t1m1.id)
await alice.readMessage(t1m3.id)
console.log("  alice read CI thread")

// Bob reads the CI thread and review
await bob.readMessage(t1m1.id)
await bob.readMessage(t1m2.id)
await bob.readMessage(t2m1.id)
console.log("  bob read CI thread + review")

// Bob does NOT read sprint planning (t3m1) — left unread
// CI bot does NOT read alice's reply — left unread

console.log("\n--- Seed complete ---\n")
console.log("Directory: 4 entries (2 human, 2 agent)")
console.log("Messages:  6 across 3 threads")
console.log("Unread:    bob has 1 unread (sprint planning)")
console.log("           auto/ci-fixer has 1 unread (alice's reply)")
