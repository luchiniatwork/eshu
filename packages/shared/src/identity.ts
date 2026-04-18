// ---------------------------------------------------------------------------
// Address parsing and validation
// ---------------------------------------------------------------------------

export interface ParsedAddress {
  /** The full address string */
  address: string
  /** Whether this is a human or agent address */
  type: "human" | "agent"
  /** The engineer name (null for auto/* agents) */
  engineer: string | null
  /** The agent type (null for bare human addresses) */
  agentType: string | null
}

/**
 * Parse an Eshu address into its components.
 *
 * Address formats:
 *   - `alice`                → human, engineer=alice
 *   - `alice/code-reviewer`  → agent, engineer=alice, agentType=code-reviewer
 *   - `auto/ci-fixer`        → agent, engineer=null, agentType=ci-fixer
 */
export function parseAddress(address: string): ParsedAddress {
  validateAddress(address)

  const slashIndex = address.indexOf("/")

  // No slash → bare human address
  if (slashIndex === -1) {
    return {
      address,
      type: "human",
      engineer: address,
      agentType: null,
    }
  }

  const prefix = address.slice(0, slashIndex)
  const suffix = address.slice(slashIndex + 1)

  // auto/* → autonomous agent
  if (prefix === "auto") {
    return {
      address,
      type: "agent",
      engineer: null,
      agentType: suffix,
    }
  }

  // name/agent-type → human-directed agent
  return {
    address,
    type: "agent",
    engineer: prefix,
    agentType: suffix,
  }
}

/**
 * Validate an address string. Throws if invalid.
 *
 * Rules:
 *   - Must be non-empty
 *   - Must contain only lowercase letters, numbers, hyphens, and at most one slash
 *   - Must not start or end with a slash or hyphen
 *   - Parts separated by slash must each be non-empty
 */
export function validateAddress(address: string): void {
  if (!address) {
    throw new AddressError("Address must not be empty")
  }

  if (address.startsWith("/") || address.endsWith("/")) {
    throw new AddressError(`Invalid address "${address}": must not start or end with /`)
  }

  if (address.startsWith("-") || address.endsWith("-")) {
    throw new AddressError(`Invalid address "${address}": must not start or end with -`)
  }

  const parts = address.split("/")
  if (parts.length > 2) {
    throw new AddressError(`Invalid address "${address}": at most one / allowed`)
  }

  for (const part of parts) {
    if (!part) {
      throw new AddressError(`Invalid address "${address}": empty segment`)
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(part)) {
      throw new AddressError(
        `Invalid address "${address}": segments must contain only lowercase letters, numbers, and hyphens`,
      )
    }
  }
}

export class AddressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AddressError"
  }
}
