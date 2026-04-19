import { describe, expect, test } from "bun:test"
import { parseTemplate } from "./editor"

describe("parseTemplate", () => {
  test("parses headers and body", () => {
    const content = "To: alice, bob\nSubject: Hello\n\nThis is the body."
    const result = parseTemplate(content)
    expect(result.headers.to).toBe("alice, bob")
    expect(result.headers.subject).toBe("Hello")
    expect(result.body).toBe("This is the body.")
  })

  test("parses headers separated by ---", () => {
    const content = "To: alice\nSubject: Test\n---\nBody here."
    const result = parseTemplate(content)
    expect(result.headers.to).toBe("alice")
    expect(result.headers.subject).toBe("Test")
    expect(result.body).toBe("Body here.")
  })

  test("lowercases header keys", () => {
    const content = "DisplayName: Alice\n\nBody"
    const result = parseTemplate(content)
    expect(result.headers.displayname).toBe("Alice")
  })

  test("body only when no headers", () => {
    const content = "Just a plain body with no headers."
    const result = parseTemplate(content)
    expect(result.headers).toEqual({})
    expect(result.body).toBe("Just a plain body with no headers.")
  })

  test("empty content", () => {
    const result = parseTemplate("")
    expect(result.headers).toEqual({})
    expect(result.body).toBe("")
  })

  test("multiline body preserved", () => {
    const content = "To: alice\n\nLine one\nLine two\nLine three"
    const result = parseTemplate(content)
    expect(result.body).toBe("Line one\nLine two\nLine three")
  })

  test("header with empty value", () => {
    const content = "To: \nSubject: \n\nBody text"
    const result = parseTemplate(content)
    expect(result.headers.to).toBe("")
    expect(result.headers.subject).toBe("")
    expect(result.body).toBe("Body text")
  })

  test("hyphenated header key", () => {
    const content = "Content-Type: text/plain\n\nBody"
    const result = parseTemplate(content)
    expect(result.headers["content-type"]).toBe("text/plain")
  })
})
