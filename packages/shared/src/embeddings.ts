import OpenAI from "openai"

const DEFAULT_MODEL = "text-embedding-3-small"

/**
 * Generate an embedding vector for the given text.
 *
 * Uses OpenAI's embedding API. Returns a 1536-dimensional vector
 * for the default model (text-embedding-3-small).
 */
export async function embed(
  text: string,
  apiKey: string,
  model: string = DEFAULT_MODEL,
): Promise<number[]> {
  const client = new OpenAI({ apiKey })

  const response = await client.embeddings.create({
    model,
    input: text,
  })

  return response.data[0].embedding
}

/**
 * Format an embedding vector as a pgvector-compatible string.
 * e.g., [0.1, 0.2, 0.3] → "[0.1,0.2,0.3]"
 */
export function toVectorString(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

/**
 * Parse a pgvector string back into a number array.
 * e.g., "[0.1,0.2,0.3]" → [0.1, 0.2, 0.3]
 */
export function fromVectorString(vectorStr: string): number[] {
  const inner = vectorStr.slice(1, -1)
  if (!inner) return []
  return inner.split(",").map(Number)
}
