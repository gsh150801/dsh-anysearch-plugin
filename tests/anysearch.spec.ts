import { describe, expect, it } from 'vitest'
import { parseSubDomainParams, clampMaxResults, ANYSEARCH_MIN_RESULTS, ANYSEARCH_MAX_RESULTS } from '../src/tools.ts'
import { parseMarkdownSources, projectSources } from '../src/provider.ts'
import { ANYSEARCH_VERTICALS, GENERAL_DOMAIN } from '../src/verticals.ts'

describe('parseSubDomainParams', () => {
  it('returns {} for undefined/blank', () => {
    expect(parseSubDomainParams(undefined)).toEqual({})
    expect(parseSubDomainParams('  ')).toEqual({})
  })

  it('parses key=value pairs', () => {
    expect(parseSubDomainParams('type=stock,symbol=AAPL,cn_code=')).toEqual({ type: 'stock', symbol: 'AAPL', cn_code: '' })
  })

  it('parses a JSON object', () => {
    expect(parseSubDomainParams('{"type":"cve","value":"CVE-2021-44228"}')).toEqual({ type: 'cve', value: 'CVE-2021-44228' })
  })

  it('falls back to pairs on malformed JSON', () => {
    expect(parseSubDomainParams('{bad}')).toEqual({})
  })
})

describe('clampMaxResults', () => {
  it('clamps into the 1-10 range and falls back on garbage', () => {
    expect(clampMaxResults(undefined, 10)).toBe(10)
    expect(clampMaxResults(0, 10)).toBe(ANYSEARCH_MIN_RESULTS)
    expect(clampMaxResults(99, 10)).toBe(ANYSEARCH_MAX_RESULTS)
    expect(clampMaxResults(Number.NaN, 5)).toBe(5)
  })
})

describe('parseMarkdownSources', () => {
  it('extracts unique markdown links with titles', () => {
    const text = '- [Apple](https://example.com/a)\n- [Apple](https://example.com/a)\n- [No Title](https://example.com/b)'
    const sources = parseMarkdownSources(text)
    expect(sources.map(s => s.url)).toEqual(['https://example.com/a', 'https://example.com/b'])
    expect(sources[0]!.title).toBe('Apple')
  })
})

describe('projectSources', () => {
  it('projects URL and title into the seam shape', () => {
    const out = projectSources([{ url: 'https://example.com/x', title: 'X' }])
    expect(out).toEqual([{ url: 'https://example.com/x', title: 'X' }])
  })
})

describe('ANYSEARCH_VERTICALS', () => {
  it('starts with the general vertical and every sub_domain tag is namespaced', () => {
    expect(ANYSEARCH_VERTICALS[0]!.domain).toBe(GENERAL_DOMAIN)
    for (const vertical of ANYSEARCH_VERTICALS) {
      for (const tag of vertical.subDomains) {
        expect(tag.startsWith(`${vertical.domain}.`)).toBe(true)
      }
    }
  })
})
