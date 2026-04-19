import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { ClientConfig, ServerConfig } from "./types"

// ---------------------------------------------------------------------------
// Config file loading
// ---------------------------------------------------------------------------

interface ConfigFile {
  project_id?: string
  api_url?: string
  api_key?: string
  user_address?: string
  agent_address?: string
  database_url?: string
  openai_api_key?: string
  api_port?: number
  embedding_model?: string
  search_threshold?: number
  search_limit?: number
}

function loadConfigFile(): ConfigFile {
  const configPath = join(homedir(), ".eshu", "config.json")
  try {
    const raw = readFileSync(configPath, "utf-8")
    return JSON.parse(raw) as ConfigFile
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Server config (API server — needs DB + OpenAI)
// ---------------------------------------------------------------------------

export function loadServerConfig(): ServerConfig {
  const file = loadConfigFile()

  const projectId = process.env.ESHU_PROJECT_ID ?? file.project_id
  if (!projectId) {
    throw new Error("ESHU_PROJECT_ID is required (env or config file)")
  }

  const databaseUrl = process.env.ESHU_DATABASE_URL ?? file.database_url
  if (!databaseUrl) {
    throw new Error("ESHU_DATABASE_URL is required (env or config file)")
  }

  const openaiApiKey = process.env.OPENAI_API_KEY ?? file.openai_api_key
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required (env or config file)")
  }

  return {
    projectId,
    databaseUrl,
    openaiApiKey,
    apiPort: Number(process.env.ESHU_API_PORT ?? file.api_port ?? 3100),
    apiKey: process.env.ESHU_API_KEY ?? file.api_key ?? null,
    embeddingModel:
      process.env.ESHU_EMBEDDING_MODEL ?? file.embedding_model ?? "text-embedding-3-small",
    searchThreshold: Number(process.env.ESHU_SEARCH_THRESHOLD ?? file.search_threshold ?? 0.25),
    searchLimit: Number(process.env.ESHU_SEARCH_LIMIT ?? file.search_limit ?? 20),
  }
}

// ---------------------------------------------------------------------------
// Client config (CLI / MCP — connects to REST API)
// ---------------------------------------------------------------------------

export function loadClientConfig(): ClientConfig {
  const file = loadConfigFile()

  const projectId = process.env.ESHU_PROJECT_ID ?? file.project_id
  if (!projectId) {
    throw new Error("ESHU_PROJECT_ID is required (env or config file)")
  }

  const apiUrl = process.env.ESHU_API_URL ?? file.api_url
  if (!apiUrl) {
    throw new Error("ESHU_API_URL is required (env or config file)")
  }

  return {
    projectId,
    apiUrl,
    apiKey: process.env.ESHU_API_KEY ?? file.api_key ?? null,
    agentAddress: process.env.ESHU_AGENT_ADDRESS ?? file.agent_address,
    userAddress: process.env.ESHU_USER_ADDRESS ?? file.user_address,
  }
}
