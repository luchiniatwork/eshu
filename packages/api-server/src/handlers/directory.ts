import {
  addDirectoryEntry,
  listDirectory,
  removeDirectoryEntry,
  updateDirectoryEntry,
  validateAddress,
} from "@eshu/shared"
import type { Context } from "hono"
import { DirectoryAddSchema, DirectoryListSchema, DirectoryUpdateSchema } from "../types"
import type { AppEnv } from "../types"

/**
 * POST /api/v1/directory — List directory entries with optional type filter.
 */
export async function listDirectoryHandler(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => ({}))
  const { type } = DirectoryListSchema.parse(body)

  const db = c.get("db")
  const projectId = c.get("projectId")

  const entries = await listDirectory(db, projectId, type)
  return c.json(entries)
}

/**
 * POST /api/v1/directory/add — Add a new directory entry.
 */
export async function addDirectoryHandler(c: Context<AppEnv>) {
  const body = await c.req.json()
  const input = DirectoryAddSchema.parse(body)

  // Validate address format
  validateAddress(input.address)

  const db = c.get("db")
  const projectId = c.get("projectId")

  const entry = await addDirectoryEntry(db, projectId, input)
  return c.json(entry, 201)
}

/**
 * PUT /api/v1/directory/:address — Update a directory entry.
 * Address is URL-encoded in the path (e.g., alice%2Fcode-reviewer).
 */
export async function updateDirectoryHandler(c: Context<AppEnv>) {
  const rawAddress = c.req.param("address")
  if (!rawAddress) {
    return c.json({ error: "Address is required" }, 400)
  }
  const address = decodeURIComponent(rawAddress)
  const body = await c.req.json()
  const updates = DirectoryUpdateSchema.parse(body)

  const db = c.get("db")
  const projectId = c.get("projectId")

  const entry = await updateDirectoryEntry(db, projectId, address, updates)
  if (!entry) {
    return c.json({ error: `Directory entry not found: "${address}"` }, 404)
  }

  return c.json(entry)
}

/**
 * DELETE /api/v1/directory/:address — Remove a directory entry.
 * Address is URL-encoded in the path.
 */
export async function removeDirectoryHandler(c: Context<AppEnv>) {
  const rawAddress = c.req.param("address")
  if (!rawAddress) {
    return c.json({ error: "Address is required" }, 400)
  }
  const address = decodeURIComponent(rawAddress)

  const db = c.get("db")
  const projectId = c.get("projectId")

  const removed = await removeDirectoryEntry(db, projectId, address)
  if (!removed) {
    return c.json({ error: `Directory entry not found: "${address}"` }, 404)
  }

  return c.json({ success: true })
}
