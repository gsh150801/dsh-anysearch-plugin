/**
 * `@deepseek-ai/dsh-web-search-anysearch`: registers an Anysearch-backed
 * `WebSearchProvider` with `ctx.web` (the general/tagless vertical) AND a set of
 * per-domain model tools (`anysearch_<domain>`, `anysearch_domains`,
 * `anysearch_batch`) over the same Anysearch JSON-RPC endpoint. A function /
 * namespace plugin (NOT a service): like the other providers it registers INTO
 * the web seam, and it also contributes tools to `ctx.tools`. Credentials come
 * from the settings section, the `ANYSEARCH_API_KEY` credential reference, or
 * the ambient environment; anonymous access is allowed without a key.
 *
 * @module @deepseek-ai/dsh-web-search-anysearch
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-web'
import type {} from '@deepseek-ai/dsh-tools'
import { callAnysearchMcp } from './client.ts'
import {
  ANYSEARCH_DEFAULT_BASE_URL,
  ANYSEARCH_TOOL_BATCH_SEARCH,
  ANYSEARCH_TOOL_GET_SUB_DOMAINS,
  ANYSEARCH_TOOL_SEARCH,
} from './types.ts'
import { AnysearchSearchProvider } from './provider.ts'
import type { AnysearchSearchProviderOptions } from './provider.ts'
import { registerAnysearchTools } from './tools.ts'
import type { AnysearchBatchFn, AnysearchDirectoryFn, AnysearchSearchFn } from './tools.ts'

export {
  ANYSEARCH_PROVIDER_ID,
  AnysearchSearchProvider,
} from './provider.ts'
export type { AnysearchSearchProviderOptions } from './provider.ts'
export {
  ANYSEARCH_VERTICALS,
  GENERAL_DOMAIN,
} from './verticals.ts'
export { parseSubDomainParams, clampMaxResults } from './tools.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-anysearch'

/** The web seam this provider registers into plus the tool registry. */
export const inject = ['web', 'tools']

/** Default environment variable naming this provider's API key. */
export const DEFAULT_API_KEY_ENV = 'ANYSEARCH_API_KEY'

/** Default environment variable naming this provider's endpoint origin. */
export const SEARCH_BASE_URL_ENV = 'ANYSEARCH_BASE_URL'

/** Plugin config (all optional — `apply` fills env-var and constant defaults). */
export interface Config {
  /** Literal Anysearch API key; prefer {@link apiKeyEnv} so no secret enters configuration files. */
  apiKey?: string
  /** Credential reference resolved for each call; defaults to `ANYSEARCH_API_KEY`. */
  apiKeyEnv?: string
  /** JSON-RPC endpoint origin; `/mcp` is appended. Defaults to the public API. */
  baseURL?: string
  /** Default result count for the seam provider when a request carries none. */
  maxResults?: number
  /** Register the `anysearch` web-search provider. Defaults to true. */
  enableProvider?: boolean
  /** Domains for which to register `anysearch_<domain>` tools; defaults to every vertical. */
  enabledDomains?: string[]
}

export const Config: z<Config> = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  baseURL: z.string(),
  maxResults: z.number().step(1).min(1),
  enableProvider: z.boolean().default(true),
  enabledDomains: z.array(z.string()),
})

/** Settings namespace carrying this provider's endpoint, result count, and key reference. */
export const WEB_SEARCH_ANYSEARCH_SETTINGS_NAMESPACE = settingsNamespace('web-search-anysearch')

/**
 * Resolve the API key for one call: the literal config, else the credential
 * reference, else the ambient environment. Yields `undefined` for anonymous.
 *
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the currently authoritative section.
 * @returns the resolved key, or `undefined` to use anonymous access.
 */
async function resolveApiKey(ctx: Context, config: Config): Promise<string | undefined> {
  if (config.apiKey !== undefined && config.apiKey.length > 0) return config.apiKey
  const ref = credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV)
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    const resolved = await credentials.resolve(ref)
    if (resolved !== undefined && resolved.value.length > 0) return resolved.value
  }
  const ambient = launchEnvironmentOf(ctx).get(ref)
  return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
}

/** Resolve the endpoint origin for one call. */
function resolveBaseUrl(ctx: Context, config: Config): string {
  return config.baseURL
    ?? launchEnvironmentOf(ctx).get(SEARCH_BASE_URL_ENV)?.value
    ?? ANYSEARCH_DEFAULT_BASE_URL
}

/** Project one resolved section into the seam provider's options. */
function resolveProviderOptions(ctx: Context, config: Config): AnysearchSearchProviderOptions {
  return {
    baseURL: resolveBaseUrl(ctx, config),
    ...config.maxResults !== undefined ? { maxResults: config.maxResults } : {},
    resolveApiKey: () => resolveApiKey(ctx, config),
  }
}

/** Register the web provider and the per-domain Anysearch tools. */
export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  installSettingsSection(ctx, WEB_SEARCH_ANYSEARCH_SETTINGS_NAMESPACE, Config, config, {
    setSource: (source) => {
      current = source
    },
    onChange: () => {},
  })

  // Every seam/credential read below re-resolves from `current()` per call.
  const callMcp = async (
    tool: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<string> => {
    const section = current()
    const apiKey = (await resolveApiKey(ctx, section)) ?? ''
    return callAnysearchMcp(
      { apiKey, baseURL: resolveBaseUrl(ctx, section) },
      tool,
      args,
      signal,
    )
  }

  if (config.enableProvider) {
    ctx.web.registerSearchProvider(new AnysearchSearchProvider(
      () => resolveProviderOptions(ctx, current()),
    ))
  }

  const search: AnysearchSearchFn = async (domain, subDomain, query, params, maxResults, signal) =>
    callMcp(ANYSEARCH_TOOL_SEARCH, {
      query,
      domain,
      sub_domain: subDomain,
      ...Object.keys(params).length > 0 ? { sub_domain_params: params } : {},
      max_results: maxResults,
    }, signal)

  const directory: AnysearchDirectoryFn = (domains, signal) =>
    callMcp(ANYSEARCH_TOOL_GET_SUB_DOMAINS, { domains }, signal)

  const batch: AnysearchBatchFn = (queries, signal) =>
    callMcp(ANYSEARCH_TOOL_BATCH_SEARCH, { queries }, signal)

  registerAnysearchTools(ctx, {
    search,
    directory,
    batch,
    enabledDomains: config.enabledDomains,
  })
}
