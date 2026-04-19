#!/usr/bin/env bun
import { ApiError, createClient } from "@eshu/api-client"
import type { EshuClient } from "@eshu/api-client"
import { loadClientConfig } from "@eshu/shared"
import type { ClientConfig } from "@eshu/shared"
import { Command } from "commander"
import { registerArchiveCommands } from "./commands/archive"
import { registerDirectoryCommand } from "./commands/directory"
import { registerInboxCommand } from "./commands/inbox"
import { registerReadCommand } from "./commands/read"
import { registerReplyCommand } from "./commands/reply"
import { registerSearchCommand } from "./commands/search"
import { registerSendCommand } from "./commands/send"
import { registerStatsCommand } from "./commands/stats"

// ---------------------------------------------------------------------------
// Lazy config + client initialization
// ---------------------------------------------------------------------------

let _config: ClientConfig | undefined
let _client: EshuClient | undefined

function getConfig(): ClientConfig {
  if (!_config) {
    _config = loadClientConfig()
  }
  return _config
}

function getClient(): EshuClient {
  if (!_client) {
    const config = getConfig()
    const address = config.userAddress
    if (!address) {
      throw new Error(
        "ESHU_USER_ADDRESS is required. Set it via environment variable or in ~/.eshu/config.json",
      )
    }
    _client = createClient({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey ?? undefined,
      address,
    })
  }
  return _client
}

// ---------------------------------------------------------------------------
// Program setup
// ---------------------------------------------------------------------------

const program = new Command()
program.name("eshu").description("Agent messaging system — terminal mail client").version("0.1.0")

// Register all commands
registerInboxCommand(program, getClient)
registerReadCommand(program, getClient)
registerSearchCommand(program, getClient)
registerSendCommand(program, getClient)
registerReplyCommand(program, getClient)
registerArchiveCommands(program, getClient)
registerDirectoryCommand(program, getClient)
registerStatsCommand(program, getClient)

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

program.parseAsync().catch((err: unknown) => {
  if (err instanceof ApiError) {
    console.error(`Error: ${err.message}`)
    if (err.details) {
      console.error(JSON.stringify(err.details, null, 2))
    }
  } else if (err instanceof Error) {
    console.error(`Error: ${err.message}`)
  } else {
    console.error(err)
  }
  process.exit(1)
})
