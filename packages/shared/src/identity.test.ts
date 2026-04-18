import { describe, expect, test } from "bun:test"
import { AddressError, parseAddress, validateAddress } from "./identity"

describe("parseAddress", () => {
  test("bare human address", () => {
    const result = parseAddress("alice")
    expect(result).toEqual({
      address: "alice",
      type: "human",
      engineer: "alice",
      agentType: null,
    })
  })

  test("human-directed agent", () => {
    const result = parseAddress("alice/code-reviewer")
    expect(result).toEqual({
      address: "alice/code-reviewer",
      type: "agent",
      engineer: "alice",
      agentType: "code-reviewer",
    })
  })

  test("autonomous agent", () => {
    const result = parseAddress("auto/ci-fixer")
    expect(result).toEqual({
      address: "auto/ci-fixer",
      type: "agent",
      engineer: null,
      agentType: "ci-fixer",
    })
  })

  test("single-char address", () => {
    const result = parseAddress("a")
    expect(result).toEqual({
      address: "a",
      type: "human",
      engineer: "a",
      agentType: null,
    })
  })

  test("address with numbers", () => {
    const result = parseAddress("bot1/test-runner2")
    expect(result).toEqual({
      address: "bot1/test-runner2",
      type: "agent",
      engineer: "bot1",
      agentType: "test-runner2",
    })
  })
})

describe("validateAddress", () => {
  test("valid addresses pass", () => {
    expect(() => validateAddress("alice")).not.toThrow()
    expect(() => validateAddress("alice/code-reviewer")).not.toThrow()
    expect(() => validateAddress("auto/ci-fixer")).not.toThrow()
    expect(() => validateAddress("a")).not.toThrow()
    expect(() => validateAddress("bob123")).not.toThrow()
  })

  test("empty address", () => {
    expect(() => validateAddress("")).toThrow(AddressError)
  })

  test("leading slash", () => {
    expect(() => validateAddress("/alice")).toThrow(AddressError)
  })

  test("trailing slash", () => {
    expect(() => validateAddress("alice/")).toThrow(AddressError)
  })

  test("leading hyphen", () => {
    expect(() => validateAddress("-alice")).toThrow(AddressError)
  })

  test("trailing hyphen", () => {
    expect(() => validateAddress("alice-")).toThrow(AddressError)
  })

  test("multiple slashes", () => {
    expect(() => validateAddress("alice/code/reviewer")).toThrow(AddressError)
  })

  test("uppercase not allowed", () => {
    expect(() => validateAddress("Alice")).toThrow(AddressError)
  })

  test("spaces not allowed", () => {
    expect(() => validateAddress("alice smith")).toThrow(AddressError)
  })

  test("special chars not allowed", () => {
    expect(() => validateAddress("alice@work")).toThrow(AddressError)
    expect(() => validateAddress("alice.smith")).toThrow(AddressError)
    expect(() => validateAddress("alice_smith")).toThrow(AddressError)
  })
})
