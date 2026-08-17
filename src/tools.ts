/**
 * Model-facing Anysearch tools over `ctx.tools`: one `anysearch_<domain>` tool per
 * vertical (each routing to that domain's `sub_domain` tags), plus `anysearch_domains`
 * (discovery of tags/required params) and `anysearch_batch` (parallel searches across
 * tags). The per-domain set is generated from `ANYSEARCH_VERTICALS`, so the tool surface
 * tracks the declared vertical table. Every tool calls Anysearch through a single
 * injected `searchText`/`domainDirectory`/`parallelSearch` seam — this module owns
 * schemas, argument validation, and result formatting, never network access.
 *
 * @module @deepseek-ai/dsh-web-search-anysearch
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, JsonValue } from '@deepseek-ai/dsh-tools'
import { ANYSEARCH_VERTICALS } from './verticals.ts'
import type { AnysearchVertical } from './verticals.ts'

/** Upper bound the Anysearch API accepts for `max_results`. */
export const ANYSEARCH_MAX_RESULTS = 10

/** Lower bound the Anysearch API accepts for `max_results`. */
export const ANYSEARCH_MIN_RESULTS = 1

/**
 * Executes one Anysearch `search` call and returns its Markdown text.
 * Implemented by the plugin (`apply`) over `callAnysearchMcp`.
 */
export type AnysearchSearchFn = (
  domain: string,
  subDomain: string,
  query: string,
  params: Record<string, unknown>,
  maxResults: number,
  signal?: AbortSignal,
) => Promise<string>

/** Returns the Anysearch sub-domain directory Markdown for one or more domains. */
export type AnysearchDirectoryFn = (domains: readonly string[], signal?: AbortSignal) => Promise<string>

/** Runs 2–5 Anysearch queries in parallel and returns the merged Markdown text. */
export type AnysearchBatchFn = (
  queries: readonly { query: string; domain?: string; sub_domain?: string; sub_domain_params?: Record<string, unknown>; max_results?: number }[],
  signal?: AbortSignal,
) => Promise<string>

/** Resolved options for `registerAnysearchTools`. */
export interface AnysearchToolsOptions {
  readonly search: AnysearchSearchFn
  readonly directory: AnysearchDirectoryFn
  readonly batch: AnysearchBatchFn
  /** Domains to register tools for; defaults to every declared vertical. */
  readonly enabledDomains: readonly string[] | undefined
}

/**
 * Parse the free-form `params` string into a flat params object, mirroring the
 * official CLI: either a JSON object or comma-separated `key=value` pairs. A
 * blank input yields `{}`.
 *
 * @param input - the `params` argument (JSON or key=value pairs), or omitted.
 * @returns the parsed params object.
 */
export function parseSubDomainParams(input: string | undefined): Record<string, unknown> {
  if (input === undefined) return {}
  const trimmed = input.trim()
  if (trimmed.length === 0) return {}
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch {
      // Fall through to key=value parsing on malformed JSON.
    }
  }
  const result: Record<string, unknown> = {}
  for (const pair of trimmed.split(',')) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    const key = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (key.length > 0) result[key] = value
  }
  return result
}

/**
 * Clamp `max_results` into the Anysearch-accepted 1–10 range.
 *
 * @param value - the requested count, or `undefined` to use the fallback.
 * @param fallback - the count returned when `value` is absent or not finite.
 * @returns the clamped, truncated positive integer in the 1–10 range.
 */
export function clampMaxResults(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback
  if (!Number.isFinite(value)) return fallback
  return Math.min(ANYSEARCH_MAX_RESULTS, Math.max(ANYSEARCH_MIN_RESULTS, Math.trunc(value)))
}

/** Tool-output canonical value: the Anysearch Markdown text. */
interface AnysearchToolValue {
  text: string
}

/**
 * Pending-call presentation: a search card titled by the tool's query.
 *
 * @param args - the raw tool arguments; `query` (when a string) titles the card.
 * @returns the generic search card view shown while the call runs.
 */
export function presentAnysearchCall(args: Record<string, unknown>): GenericCallView {
  const query = typeof args['query'] === 'string' ? args['query'] : undefined
  return { card: 'generic', title: query ?? 'Anysearch', kind: 'search' }
}

/**
 * Register the Anysearch model tools for every enabled vertical (plus the
 * `anysearch_domains` and `anysearch_batch` utilities).
 *
 * @param ctx - plugin context carrying `ctx.tools`.
 * @param options - search/directory/batch seams and the enabled-domain set.
 */
export function registerAnysearchTools(ctx: Context, options: AnysearchToolsOptions): void {
  const enabled = new Set(options.enabledDomains ?? ANYSEARCH_VERTICALS.map(v => v.domain))
  const defaultMaxResults = 10

  for (const vertical of ANYSEARCH_VERTICALS) {
    if (!enabled.has(vertical.domain)) continue
    registerVerticalTool(ctx, vertical, options.search, defaultMaxResults)
  }

  // Discovery: tags + required params for one or more domains.
  ctx.tools.register(defineTool({
    name: 'anysearch_domains',
    description: 'Discover the available Anysearch vertical tags (sub_domain) and their required parameters for one or more domains, e.g. finance, security, legal. Call this before anysearch_<domain> when unsure which tag or parameter to use.',
    parameters: {
      domains: { type: 'string', required: true, description: 'Comma-separated Anysearch domains (up to 5), e.g. "finance,security,legal".' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string', required: true } },
      },
      render: (_args: unknown, value: JsonValue) => [{ type: 'text', text: (value as unknown as AnysearchToolValue).text }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const list = (args as { domains: string }).domains
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0)
        .slice(0, 5)
      const text = await options.directory(list, exec.signal)
      return { text }
    },
    presentCall: presentAnysearchCall,
  }))

  // Parallel: 2–5 queries, possibly across different tags.
  ctx.tools.register(defineTool({
    name: 'anysearch_batch',
    description: 'Run 2 to 5 Anysearch queries in parallel, optionally across different vertical tags, and return the merged Markdown results. Use for multi-angle or multi-domain research.',
    parameters: {
      queries: {
        type: 'array',
        required: true,
        description: '2-5 query objects.',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            query: { type: 'string', description: 'The search query.' },
            domain: { type: 'string', description: 'Optional Anysearch domain, e.g. finance.' },
            sub_domain: { type: 'string', description: 'Optional vertical tag, e.g. finance.quote.' },
            sub_domain_params: { type: 'object', additionalProperties: true, description: 'Optional tag parameters (key to value).' },
            max_results: { type: 'integer', description: 'Optional 1-10.' },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string', required: true } },
      },
      render: (_args: unknown, value: JsonValue) => [{ type: 'text', text: (value as unknown as AnysearchToolValue).text }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const raw = (args as { queries: unknown[] }).queries ?? []
      if (raw.length < 2 || raw.length > 5) {
        throw new Error('queries must contain between 2 and 5 items')
      }
      const queries = raw.map((item) => {
        const q = item as { query?: unknown; domain?: unknown; sub_domain?: unknown; sub_domain_params?: unknown; max_results?: unknown }
        const query = typeof q.query === 'string' ? q.query : ''
        if (query.trim().length === 0) throw new Error('every query object needs a non-empty query')
        const params = q.sub_domain_params !== undefined && typeof q.sub_domain_params === 'object' && q.sub_domain_params !== null
          ? q.sub_domain_params as Record<string, unknown>
          : {}
        return {
          query,
          ...typeof q.domain === 'string' && q.domain.length > 0 ? { domain: q.domain } : {},
          ...typeof q.sub_domain === 'string' && q.sub_domain.length > 0 ? { sub_domain: q.sub_domain } : {},
          ...Object.keys(params).length > 0 ? { sub_domain_params: params } : {},
          ...typeof q.max_results === 'number' ? { max_results: clampMaxResults(q.max_results, defaultMaxResults) } : {},
        }
      })
      const text = await options.batch(queries, exec.signal)
      return { text }
    },
    presentCall: presentAnysearchCall,
  }))
}

/** Register the single per-domain `anysearch_<domain>` tool for one vertical. */
function registerVerticalTool(
  ctx: Context,
  vertical: AnysearchVertical,
  search: AnysearchSearchFn,
  defaultMaxResults: number,
): void {
  const firstTag = vertical.subDomains[0] ?? `${vertical.domain}.${vertical.domain}`
  ctx.tools.register(defineTool({
    name: `anysearch_${vertical.domain}`,
    description: `${vertical.label}. Vertical search for the Anysearch "${vertical.domain}" tag family. Choose a sub_domain tag; use anysearch_domains to list a tag\u2019s required parameters, then pass them as params (key=value or JSON).`,
    parameters: {
      query: { type: 'string', required: true, description: `The search query for ${vertical.domain}.` },
      sub_domain: {
        type: 'string',
        description: `Tag to route to. Defaults to ${firstTag}.`,
        ...vertical.subDomains.length > 1 ? { enum: vertical.subDomains } : {},
      },
      params: {
        type: 'string',
        description: 'Optional tag parameters as key=value pairs (e.g. "type=stock,symbol=AAPL,cn_code=") or a JSON object. Include every required field of the chosen tag.',
      },
      max_results: { type: 'integer', description: '1-10, default 10.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string', required: true } },
      },
      render: (_args: unknown, value: JsonValue) => [{ type: 'text', text: (value as unknown as AnysearchToolValue).text }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const input = args as { query: string; sub_domain?: string; params?: string; max_results?: number }
      if (input.query.trim().length === 0) throw new Error('query must be a non-empty string')
      const subDomain = input.sub_domain !== undefined && input.sub_domain.length > 0 ? input.sub_domain : firstTag
      const params = parseSubDomainParams(input.params)
      const text = await search(
        vertical.domain,
        subDomain,
        input.query,
        params,
        clampMaxResults(input.max_results, defaultMaxResults),
        exec.signal,
      )
      return { text }
    },
    presentCall: presentAnysearchCall,
  }))
}
