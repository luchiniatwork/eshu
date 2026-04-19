# AGENTS.md

Eshu is an agent messaging system — a Bun/TypeScript monorepo with 5 packages under `packages/`.
Runtime is Bun (no compile step; `.ts` files execute directly). Formatting and linting use Biome.

## Build & Dev Commands

```bash
bun install                                  # install dependencies
bun run typecheck                            # tsc --noEmit in all packages
bun run lint                                 # biome lint (report only)
bun run format                               # biome format --write (auto-fix)
bun run check                                # biome lint + format check (no auto-fix)
bun run --filter '@eshu/api-server' dev      # dev server with --watch
```

There is no build/compile step. All packages set `"main": "src/index.ts"` and `"noEmit": true`.

## Testing

Tests use Bun's built-in test runner (`bun:test`). Test files are co-located with source as `*.test.ts`.

```bash
bun run test                                 # run all tests in all packages
bun test packages/shared/src/identity.test.ts                    # single file
bun test packages/shared/src/identity.test.ts -t "bare human"   # single test by name pattern
```

Integration tests that need external services use `describe.skipIf`:
```ts
describe.skipIf(!process.env.OPENAI_API_KEY)("embed (integration)", () => { ... })
```

### Test conventions

- Import from `bun:test`: `describe`, `test`, `expect`, `beforeEach`, `afterEach`
- Group tests with `describe` named after the function under test
- Test names are short lowercase phrases, not sentences — no "should" prefix
  Good: `"bare human address"`, `"throws when required vars missing"`, `"roundtrip"`
- Use `expect(x).toEqual(...)` for deep equality, `.toBe(...)` for primitives
- Use `expect(() => fn()).toThrow(ErrorClass)` for error cases
- Save and restore `process.env` in `beforeEach`/`afterEach` when testing config

## Formatting (Biome)

Configured in `biome.json`:

| Rule             | Value                |
|------------------|----------------------|
| Indent           | 2 spaces             |
| Line width       | 100 characters       |
| Quotes           | Double (`"`)         |
| Semicolons       | `asNeeded` (omitted) |
| Import sorting   | Enabled              |
| Linter rules     | `recommended`        |

Run `bun run format` to auto-fix. Run `bun run check` before committing.

## Imports

Three groups, enforced by Biome's import organizer:

```ts
import { readFileSync } from "node:fs"          // 1. Node built-ins (always node: prefix)
import { Kysely } from "kysely"                  // 2. Third-party packages
import type { ServerConfig } from "./types"      // 3. Local/relative imports
```

Use `import type` for type-only imports — never import types with regular `import`.

## Naming Conventions

| Element              | Convention       | Example                          |
|----------------------|------------------|----------------------------------|
| Variables, functions | camelCase        | `projectId`, `parseAddress()`    |
| Types, interfaces    | PascalCase       | `DirectoryEntry`, `SendResult`   |
| Error classes        | PascalCase+Error | `AddressError`                   |
| Module constants     | UPPER_SNAKE_CASE | `DEFAULT_MODEL`                  |
| DB columns           | snake_case       | `thread_id`, `created_at`        |
| Files, directories   | kebab-case       | `api-server`, `identity.ts`      |
| Packages             | `@eshu/` scope   | `@eshu/shared`, `@eshu/cli`      |
| SQL migrations       | `NNN_name.sql`   | `001_create_directory_entry.sql`  |

## Type Definitions

- All types live in a single `types.ts` per package, re-exported through `index.ts`
- Organize sections with comment banners:
  ```ts
  // ---------------------------------------------------------------------------
  // Domain types (camelCase, used by application code)
  // ---------------------------------------------------------------------------
  ```
- Two naming layers: domain types (camelCase fields) and Kysely table interfaces (snake_case fields)
- Use `?` for optional fields, `| null` for nullable, both for optional + nullable
- Use discriminated unions via string literals: `type: "human" | "agent"`
- Use Kysely's `Generated<T>` for auto-generated columns, `Selectable<T>` / `Insertable<T>` / `Updateable<T>` for row helpers

## Error Handling

- **Custom errors**: extend `Error`, set `this.name` explicitly
  ```ts
  export class AddressError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "AddressError"
    }
  }
  ```
- **Not-found**: return `null`, not an exception
- **Mutations**: return `boolean` (e.g. `numDeletedRows > 0n`) or a result object (`{ wasUnread: boolean }`)
- **Config errors**: `throw new Error(...)` with a message naming the env var and where to set it
- **Optional config**: silently catch and return fallback (e.g. missing config file → `{}`)

## Module & File Organization

- Monorepo with Bun workspaces (`"workspaces": ["packages/*"]`)
- Dependency graph: `shared` ← `api-server`; `shared` → types only → `api-client` ← `mcp-server`, `cli`
- Each package has `src/index.ts` as barrel export — all public API goes through it
- Internal helpers omit `export`; if it's not in the barrel, it's private
- All package `tsconfig.json` files extend the root: `{ "extends": "../../tsconfig.json", "include": ["src"] }`

## Architecture Patterns

- **Function-based DI**: every DB function takes `Kysely<Database>` as its first arg — no singletons
  ```ts
  export async function listDirectory(db: Kysely<Database>, projectId: string, ...): Promise<...>
  ```
- **Factory functions over classes**: `createDb(url)` returns a Kysely instance, no service classes
- **Row-to-domain mapping**: snake_case DB rows are converted to camelCase domain objects at the data-access boundary via helper functions (e.g. `toDirectoryEntry()`)
- **Transactions**: `db.transaction().execute(async (trx) => { ... })` passing `trx` to inner queries
- **Config precedence**: env vars > config file (`~/.eshu/config.json`) > hardcoded defaults

## TypeScript Strictness

The root `tsconfig.json` enforces:
- `strict: true`
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- Target/module: `ESNext`, module resolution: `bundler`

## Comments

- Section dividers: `// ---...--- \n // Section Name \n // ---...---`
- JSDoc on public API functions with description and `@returns` when non-obvious
- Inline comments only for non-obvious logic, used sparingly

## Commit Messages

Conventional commits: `type: description`
- `feat:` new feature, `fix:` bug fix, `build:` build/tooling, `docs:` documentation
- Keep the subject line concise; use `--` to add brief context after the summary
