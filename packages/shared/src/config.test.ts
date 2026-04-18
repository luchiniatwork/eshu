import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { loadClientConfig, loadServerConfig } from "./config"

describe("loadServerConfig", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear all ESHU_ and OPENAI_ env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("ESHU_") || key.startsWith("OPENAI_")) {
        delete process.env[key]
      }
    }
  })

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("ESHU_") || key.startsWith("OPENAI_")) {
        delete process.env[key]
      }
    }
    Object.assign(process.env, originalEnv)
  })

  test("loads from env vars", () => {
    process.env.ESHU_PROJECT_ID = "test-project"
    process.env.ESHU_DATABASE_URL = "postgresql://localhost/test"
    process.env.OPENAI_API_KEY = "sk-test"

    const config = loadServerConfig()

    expect(config.projectId).toBe("test-project")
    expect(config.databaseUrl).toBe("postgresql://localhost/test")
    expect(config.openaiApiKey).toBe("sk-test")
  })

  test("applies defaults for optional values", () => {
    process.env.ESHU_PROJECT_ID = "test-project"
    process.env.ESHU_DATABASE_URL = "postgresql://localhost/test"
    process.env.OPENAI_API_KEY = "sk-test"

    const config = loadServerConfig()

    expect(config.apiPort).toBe(3100)
    expect(config.apiKey).toBeNull()
    expect(config.embeddingModel).toBe("text-embedding-3-small")
    expect(config.searchThreshold).toBe(0.25)
    expect(config.searchLimit).toBe(20)
  })

  test("env vars override defaults", () => {
    process.env.ESHU_PROJECT_ID = "test-project"
    process.env.ESHU_DATABASE_URL = "postgresql://localhost/test"
    process.env.OPENAI_API_KEY = "sk-test"
    process.env.ESHU_API_PORT = "4000"
    process.env.ESHU_API_KEY = "secret"
    process.env.ESHU_EMBEDDING_MODEL = "text-embedding-3-large"
    process.env.ESHU_SEARCH_THRESHOLD = "0.5"
    process.env.ESHU_SEARCH_LIMIT = "50"

    const config = loadServerConfig()

    expect(config.apiPort).toBe(4000)
    expect(config.apiKey).toBe("secret")
    expect(config.embeddingModel).toBe("text-embedding-3-large")
    expect(config.searchThreshold).toBe(0.5)
    expect(config.searchLimit).toBe(50)
  })

  test("throws when required vars missing", () => {
    expect(() => loadServerConfig()).toThrow("ESHU_PROJECT_ID is required")

    process.env.ESHU_PROJECT_ID = "test-project"
    expect(() => loadServerConfig()).toThrow("ESHU_DATABASE_URL is required")

    process.env.ESHU_DATABASE_URL = "postgresql://localhost/test"
    expect(() => loadServerConfig()).toThrow("OPENAI_API_KEY is required")
  })
})

describe("loadClientConfig", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("ESHU_")) {
        delete process.env[key]
      }
    }
  })

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("ESHU_")) {
        delete process.env[key]
      }
    }
    Object.assign(process.env, originalEnv)
  })

  test("loads from env vars", () => {
    process.env.ESHU_PROJECT_ID = "test-project"
    process.env.ESHU_API_URL = "http://localhost:3100/api/v1"
    process.env.ESHU_AGENT_ADDRESS = "alice/code-reviewer"
    process.env.ESHU_USER_ADDRESS = "alice"

    const config = loadClientConfig()

    expect(config.projectId).toBe("test-project")
    expect(config.apiUrl).toBe("http://localhost:3100/api/v1")
    expect(config.agentAddress).toBe("alice/code-reviewer")
    expect(config.userAddress).toBe("alice")
  })

  test("throws when required vars missing", () => {
    expect(() => loadClientConfig()).toThrow("ESHU_PROJECT_ID is required")

    process.env.ESHU_PROJECT_ID = "test-project"
    expect(() => loadClientConfig()).toThrow("ESHU_API_URL is required")
  })

  test("optional addresses are undefined when not set", () => {
    process.env.ESHU_PROJECT_ID = "test-project"
    process.env.ESHU_API_URL = "http://localhost:3100/api/v1"

    const config = loadClientConfig()

    expect(config.agentAddress).toBeUndefined()
    expect(config.userAddress).toBeUndefined()
    expect(config.apiKey).toBeNull()
  })
})
