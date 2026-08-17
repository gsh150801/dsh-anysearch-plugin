/**
 * Wire types for the Anysearch MCP endpoint (`POST {baseURL}/mcp`, JSON-RPC 2.0
 * `tools/call`). Types only — no runtime code. Anysearch returns each tool's
 * output as one or more `{ type: 'text', text }` content blocks whose `text` is
 * Markdown (search results, structured vertical data, or the sub-domain
 * directory table).
 *
 * @module @deepseek-ai/dsh-web-search-anysearch/types
 */

/** Default Anysearch API origin; `/mcp` is appended for JSON-RPC calls. */
export const ANYSEARCH_DEFAULT_BASE_URL = 'https://api.anysearch.com'

/** JSON-RPC method this client issues. */
export const ANYSEARCH_MCP_METHOD = 'tools/call'

/** Tool names the Anysearch MCP server exposes. */
export const ANYSEARCH_TOOL_SEARCH = 'search'
/** Tool name for discovering a domain's sub-domain directory. */
export const ANYSEARCH_TOOL_GET_SUB_DOMAINS = 'get_sub_domains'
/** Tool name for running 2–5 queries in parallel. */
export const ANYSEARCH_TOOL_BATCH_SEARCH = 'batch_search'

/** One JSON-RPC request body sent to the Anysearch MCP server. */
export interface AnysearchMcpRequest {
  jsonrpc: '2.0'
  id: number
  method: typeof ANYSEARCH_MCP_METHOD
  params: {
    name: string
    arguments: Record<string, unknown>
  }
}

/** A `{ type: 'text', text }` content block in the JSON-RPC result. */
export interface AnysearchTextContent {
  type: 'text'
  text: string
}

/** Anysearch MCP JSON-RPC response (result or error branch). */
export interface AnysearchMcpResponse {
  result?: {
    content?: AnysearchTextContent[]
  }
  error?: {
    message?: string
  }
}

/** One normalized citation parsed out of a Markdown source list. */
export interface AnysearchSourceRef {
  readonly url: string
  readonly title?: string
  readonly snippet?: string
}
