import { createDb, loadServerConfig } from "@eshu/shared"
import { createApp } from "./app"

const config = loadServerConfig()
const db = createDb(config.databaseUrl)
const app = createApp(config, db)

console.log(`Eshu API server starting on port ${config.apiPort}`)
console.log(`Project: ${config.projectId}`)

export default {
  port: config.apiPort,
  fetch: app.fetch,
}
