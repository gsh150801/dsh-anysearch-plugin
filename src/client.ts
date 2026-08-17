/**
 * A thin JSON-RPC 2.0 client for the Anysearch MCP endpoint (`POST {baseURL}/mcp`,
 * method `tools/call`). Each tool invocation returns the concatenated Markdown text
 * of its `{ type: 'text' }` content blocks — the exact shape the official Anysearch
 * CLI consumes. Cancellation is honored via the caller's `AbortSignal` and surfaced
 * as `WEB_ABORTED`; every other transport/API failure maps to `WEB_PROVIDER_ERROR`.
 *
 * @module @deepseek-ai/dsh-web-search-anysearch
 */

import { WebError } from '@deepseek-ai/dsh-web'
import {
  ANYSEARCH_MCP_METHOD,
} from './types.ts'
import type {
  AnysearchMcpRequest,
  AnysearchMcpResponse,
} from './types.ts'

/** Identifies the client to the backend (client-family/version) and is sent on every call. */
export const ANYSEARCH_CLIENT_HEADER = 'dsh-web-search-anysearch/0.1.0'

/** Resolved client options (the plugin's `apply` supplies env-var and constant defaults). */
export interface AnysearchClientOptions {
  /** Anysearch API key; empty/absent falls back to anonymous (lower rate limits). */
  readonly apiKey: string
  /** API origin; `/mcp` is appended. */
  readonly baseURL: string
}

/**
 * Call one Anysearch MCP tool and return its concatenated Markdown text.
 *
 * @param options - the resolved client options (API origin and optional key).
 * @param tool - the Anysearch tool name (`search`, `batch_search`, `get_sub_domains`).
 * @param args - the tool's flat JSON arguments.
 * @param signal - optional cancellation; aborts surface as `WEB_ABORTED`.
 * @returns the concatenated text of the JSON-RPC result's text content blocks.
 */
export async function callAnysearchMcp(
  options: AnysearchClientOptions,
  tool: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const payload: AnysearchMcpRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: ANYSEARCH_MCP_METHOD,
    params: { name: tool, arguments: args },
  }

  let response: Response
  try {
    response = await fetch(`${options.baseURL}/mcp`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'user-agent': ANYSEARCH_CLIENT_HEADER,
        'x-anysearch-client': ANYSEARCH_CLIENT_HEADER,
        ...options.apiKey.length > 0 ? { 'authorization': `Bearer ${options.apiKey}` } : {},
      },
      body: JSON.stringify(payload),
      ...signal !== undefined ? { signal } : {},
    })
  } catch (error: unknown) {
    if (isAbortError(error)) throw new WebError('Anysearch call aborted', 'WEB_ABORTED', { cause: error })
    throw new WebError(`Anysearch call failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
  }

  if (!response.ok) {
    const status = response.status
    let message = `Anysearch API error (HTTP ${status})`
    try {
      const parsed = await response.json() as AnysearchMcpResponse
      const detail = parsed.error?.message
      if (detail !== undefined && detail.length > 0) message = detail
    } catch (error: unknown) {
      if (isAbortError(error)) throw new WebError('Anysearch call aborted', 'WEB_ABORTED', { cause: error })
    }
    throw new WebError(message, 'WEB_PROVIDER_ERROR')
  }

  let parsed: AnysearchMcpResponse
  try {
    parsed = await response.json() as AnysearchMcpResponse
  } catch (error: unknown) {
    if (isAbortError(error)) throw new WebError('Anysearch call aborted', 'WEB_ABORTED', { cause: error })
    throw new WebError(`Anysearch returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
  }

  if (parsed.error?.message !== undefined && parsed.error.message.length > 0) {
    throw new WebError(parsed.error.message, 'WEB_PROVIDER_ERROR')
  }

  const blocks = parsed.result?.content ?? []
  const text = blocks
    .filter(block => block.type === 'text' && block.text.length > 0)
    .map(block => block.text)
    .join('\n\n')
  if (text.length === 0) {
    throw new WebError('Anysearch returned no text content', 'WEB_PROVIDER_ERROR')
  }
  return text
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
