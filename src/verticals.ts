/**
 * Declarative Anysearch vertical-directory table. Each row maps one Anysearch
 * `domain` to the `sub_domain` tags it exposes; the per-domain model tools in
 * `tools.ts` are generated from this table, so adding or dropping a tag here
 * changes the surfaced tool set without touching tool code.
 *
 * Source of truth: `get_sub_domains` responses captured from the Anysearch API.
 *
 * @module @deepseek-ai/dsh-web-search-anysearch
 */

/** One Anysearch vertical domain and the sub-domain tags it exposes. */
export interface AnysearchVertical {
  /** Anysearch `domain` value (also becomes the tool's `anysearch_<domain>` suffix). */
  readonly domain: string
  /** Tool display purpose. */
  readonly label: string
  /** The `sub_domain` tags this domain routes to. */
  readonly subDomains: readonly string[]
}

/** The single general (tagless) vertical; routed through `general.general`. */
export const GENERAL_DOMAIN = 'general'

/**
 * Every supported vertical domain with its sub-domain tags. `general` is first:
 * it backs the dedicated `anysearch_general` tool and the seam provider.
 */
export const ANYSEARCH_VERTICALS: readonly AnysearchVertical[] = [
  { domain: 'general', label: 'General web search', subDomains: ['general.general'] },
  { domain: 'finance', label: 'Financial data, news, quotes and indicators', subDomains: ['finance.quote', 'finance.news', 'finance.calendar', 'finance.macro', 'finance.fundamental', 'finance.screen'] },
  { domain: 'academic', label: 'Academic papers, preprints, citations and datasets', subDomains: ['academic.search', 'academic.preprint', 'academic.biomedical', 'academic.citation', 'academic.dataset'] },
  { domain: 'health', label: 'Drugs, clinical trials and health statistics', subDomains: ['health.drug', 'health.trial', 'health.stats'] },
  { domain: 'code', label: 'Code snippets and library documentation', subDomains: ['code.snippet', 'code.doc'] },
  { domain: 'travel', label: 'Flight booking and live flight status', subDomains: ['travel.flight', 'travel.flight_status'] },
  { domain: 'business', label: 'Jobs, companies, trade and people', subDomains: ['business.jobs', 'business.company', 'business.trade', 'business.people'] },
  { domain: 'security', label: 'CVEs, threat intel, scans and IP noise checks', subDomains: ['security.vuln', 'security.intel', 'security.scan', 'security.noise'] },
  { domain: 'energy', label: 'Energy production and electricity markets', subDomains: ['energy.production', 'energy.electricity'] },
  { domain: 'legal', label: 'Legislation, court cases and statutes', subDomains: ['legal.legislation', 'legal.case', 'legal.statute'] },
  { domain: 'ip', label: 'Global patent data and family tracing', subDomains: ['ip.global'] },
  { domain: 'environment', label: 'Real-time air quality index data', subDomains: ['environment.aqi'] },
  { domain: 'agriculture', label: 'FAO agriculture statistics', subDomains: ['agriculture.fao'] },
  { domain: 'resource', label: 'Stock photos and vector graphics', subDomains: ['resource.image'] },
  { domain: 'social_media', label: 'Media and community content (Weibo, Zhihu, X, Reddit, LinkedIn, …)', subDomains: ['social_media.social_media'] },
  { domain: 'film', label: 'Film and music torrent resources', subDomains: ['film.torrent'] },
  { domain: 'gaming', label: 'Steam store prices and esports data', subDomains: ['gaming.store', 'gaming.esports'] },
]
