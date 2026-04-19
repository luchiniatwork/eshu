import type { EshuClient } from "@eshu/api-client"
import { loadClientConfig } from "@eshu/shared"
import type { Command } from "commander"
import { formatNumber, pc, printJson, separator } from "../format"

export function registerStatsCommand(program: Command, getClient: () => EshuClient): void {
  program
    .command("stats")
    .description("Project statistics dashboard")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = getClient()
      const stats = await client.stats()

      if (opts.json) {
        printJson(stats)
        return
      }

      const config = loadClientConfig()

      console.log()
      console.log(`  ${pc.bold("Project:")} ${config.projectId}`)
      console.log(`  ${separator(45)}`)
      console.log()

      console.log(`  ${pc.bold("Messages:")}`)
      console.log(`    Total:              ${formatNumber(stats.messages.total)}`)
      console.log(`    This week:          ${formatNumber(stats.messages.thisWeek)}`)
      console.log(`    Threads:            ${formatNumber(stats.messages.threads)}`)
      console.log()

      console.log(`  ${pc.bold("Directory:")}`)
      console.log(`    Humans:             ${formatNumber(stats.directory.humans)}`)
      console.log(`    Agents:             ${formatNumber(stats.directory.agents)}`)
      console.log()

      if (stats.byParticipant.length > 0) {
        console.log(`  ${pc.bold("By participant (last 7 days):")}`)
        for (const p of stats.byParticipant) {
          const label = p.address.padEnd(20)
          console.log(
            `    ${label} ${formatNumber(p.sent)} sent, ${formatNumber(p.received)} received`,
          )
        }
        console.log()
      }

      if (stats.unread.length > 0) {
        console.log(`  ${pc.bold("Unread messages:")}`)
        for (const u of stats.unread) {
          const label = u.address.padEnd(20)
          console.log(`    ${label} ${formatNumber(u.count)} unread`)
        }
        console.log()
      }
    })
}
