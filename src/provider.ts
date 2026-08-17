/**
 * `AnysearchSearchProvider`: a `WebSearchProvider` backed by the Anysearch MCP
 * `search` tool's general (tagless) vertical. Anysearch answers general queries
 * as Markdown text (`general.general`), so this adapter maps that text onto the
 * seam: the whole Markdown becomes the result's `content`, and any Markdown
 * links inside it become citeable `sources` (title from the link text). Entries
 * without a portable URL stay inside `content` rather than being invented as
 * sources.
 *
 * @module @deepseek-ai/dsh-web-search-anysearch/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'
import { callAnysearchMcp } from './client.ts'
import { ANYSEARCH_TOOL_SEARCH } from './types.ts'
import { GENERAL_DOMAIN } from './verticals.ts'
import type { AnysearchSourceRef } from './types.ts'

/** Stable id this provider registers under. */
export const ANYSEARCH_PROVIDER_ID = 'anysearch'

/** Resolved provider options (the plugin's `apply` supplies env-var and constant defaults). */
export interface AnysearchSearchProviderOptions {
  /** API origin; `/mcp` is appended. */
  readonly baseURL: string
  /** Default result count when a request carries no `maxResults`. Omitted = none. */
  readonly maxResults?: number
  /** Async credential resolver for the API key; anonymous when it yields empty/undefined. */
  readonly resolveApiKey?: () => Promise<string | undefined>
}

/**
 * The Anysearch-backed search provider; anonymous access is allowed without a
 * key. Options are read lazily via a thunk so settings/environment changes are
 * reflected on the next call without re-registration (mirrors the DeepSeek
 * search provider).
 */
export class AnysearchSearchProvider implements WebSearchProvider {
  readonly id = ANYSEARCH_PROVIDER_ID

  constructor(private readonly options: () => AnysearchSearchProviderOptions) {}

  available(): boolean {
    return URL.canParse(`${this.options().baseURL}/mcp`)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const resolved = this.options()
    const numResults = request.maxResults ?? resolved.maxResults
    const apiKey = resolved.resolveApiKey !== undefined ? (await resolved.resolveApiKey()) ?? '' : ''
    let text: string
    try {
      text = await callAnysearchMcp(
        { apiKey, baseURL: resolved.baseURL },
        ANYSEARCH_TOOL_SEARCH,
        {
          query: request.query,
          domain: GENERAL_DOMAIN,
          sub_domain: `${GENERAL_DOMAIN}.${GENERAL_DOMAIN}`,
          ...numResults !== undefined ? { max_results: numResults } : {},
        },
        signal,
      )
    } catch (error: unknown) {
      if (error instanceof WebError && error.code === 'WEB_ABORTED') throw error
      throw error
    }
    const sources = projectSources(parseMarkdownSources(text))
    return { content: text, sources, truncated: false }
  }
}

/**
 * Parse every Markdown hyperlink in `text` into `AnysearchSourceRef`s, with the
 * inner link text as title. Duplicate URLs are dropped.
 *
 * @param text - the Anysearch Markdown output.
 * @returns the parsed citation refs, in first-appearance order.
 */
export function parseMarkdownSources(text: string): AnysearchSourceRef[] {
  const seen = new Set<string>()
  const sources: AnysearchSourceRef[] = []
  const linkRe = /\[([^\]]*)\]\((\s*(?:https?:\/\/)[^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = linkRe.exec(text)) !== null) {
    const title = match[1]?.trim() ?? ''
    const url = match[2]?.trim() ?? ''
    if (url.length === 0 || seen.has(url)) continue
    seen.add(url)
    sources.push({
      url,
      ...title.length > 0 ? { title } : {},
    })
  }
  return sources
}

/**
 * Project parsed citation refs into the seam's `WebSearchSource` shape.
 *
 * @param refs - parsed citation refs.
 * @returns seam-shaped sources.
 */
export function projectSources(refs: readonly AnysearchSourceRef[]): WebSearchSource[] {
  return refs.map(ref => ({
    url: ref.url,
    ...ref.title !== undefined && ref.title.length > 0 ? { title: ref.title } : {},
  }))
}
