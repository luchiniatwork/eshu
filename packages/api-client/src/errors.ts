/**
 * Error thrown when the Eshu API returns a non-2xx response.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}
