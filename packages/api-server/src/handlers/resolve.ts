import type { Database } from "@eshu/shared"
import type { Kysely } from "kysely"

/**
 * Batch-resolve display names for a set of addresses.
 *
 * @returns Map from address to display name. Addresses not found in the
 *          directory are omitted from the map (callers should fall back to null).
 */
export async function resolveDisplayNames(
  db: Kysely<Database>,
  projectId: string,
  addresses: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(addresses)]
  if (unique.length === 0) return new Map()

  const rows = await db
    .selectFrom("directory_entry")
    .select(["address", "display_name"])
    .where("project_id", "=", projectId)
    .where("address", "in", unique)
    .execute()

  return new Map<string, string>(rows.map((r) => [r.address, r.display_name]))
}
