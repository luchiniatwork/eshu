/**
 * Options for creating an Eshu API client.
 */
export interface ClientOptions {
  /** Base URL of the Eshu API server (e.g., "http://localhost:3100") */
  apiUrl: string
  /** API key for authentication (required if the server enforces auth) */
  apiKey?: string
  /** Caller's directory address (sent as X-Eshu-Address header) */
  address: string
}
