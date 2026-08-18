# dsh-anysearch-plugin

[![CI](https://github.com/gsh150801/dsh-anysearch-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/gsh150801/dsh-anysearch-plugin/actions/workflows/ci.yml) · [![dsh-plugin](https://img.shields.io/badge/dsh--plugin-DeepSeek%20Harness-2766c0)](https://github.com/topics/dsh-plugin)

> **Read this in:** [English](README.md) · [简体中文](README.zh.md)
>
> This repository is a **DeepSeek Harness plugin** (`dsh-plugin`). For discoverability, add
> the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository
> (see the [DeepSeek Harness docs](https://github.com/deepseek-ai/deepseek-harness)).

---

## 1. About the plugin

An **[Anysearch](https://anysearch.com)-backed** search plugin for the
[**DeepSeek Harness**](https://github.com/deepseek-ai/deepseek-harness) web capability
seam (`ctx.web`). It is a self-contained **Cordis plugin**: it can be installed as an
external npm package into any DSH composition.

It offers three things over the same Anysearch JSON-RPC endpoint:

1. **A `WebSearchProvider`** (`id: anysearch`) registered into `ctx.web` for the general,
   tagless vertical — usable as the standard `web_search` backend when selected.
2. **One model tool per vertical** — `anysearch_<domain>` for all 17 domains
   (`finance`, `security`, `legal`, `academic`, `health`, `code`, `ip`, …).
3. **Support tools** — `anysearch_domains` (tag directory + required params) and
   `anysearch_batch` (run 2–5 queries in parallel, merged Markdown).

### Tools

| Tool | Purpose |
|---|---|
| `anysearch_<domain>` | Vertical search for one tag family. Args: `query`, `sub_domain` (tag), `params` (key=value or JSON), `max_results` (1–10). |
| `anysearch_domains` | Discover the tag directory (sub_domain + required parameters) for 1–5 domains. |
| `anysearch_batch` | Run 2–5 queries across domains/tags in parallel; returns merged Markdown. |

Call `anysearch_domains` first when unsure which `sub_domain` tag or required `params` a
domain needs.

---

## 2. Installation

### Install into DSH

The package is a plain Cordis plugin. Install the npm package and add a row to your
harness composition (`cordis.yml` / agent preset):

```yaml
- id: web-search-anysearch
  name: '@deepseek-ai/dsh-web-search-anysearch'
  config:
    apiKeyEnv: ANYSEARCH_API_KEY       # optional; anonymous is allowed (lower rate limit)
    enabledDomains:
      - general
      - finance
      - security
      - legal
      - academic
```

To use Anysearch as the underlying `web_search` backend, set the `web` provider too:

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: anysearch
```

`enabledDomains` defaults to **all 17 domains**; omit it or pass an empty array to get
every vertical tool. Set `ANYSEARCH_API_KEY` for higher throughput (optional).

### Developing from source

```sh
npm install          # installs peer + dev deps (dsh-* packages are on npm)
npm run typecheck
npm run build        # tsc -> lib/
npm test             # vitest
```

---

## 3. Configuration & usage

### Composition config

| Field | Type | Default | Notes |
|---|---|---|---|
| `apiKeyEnv` | string (credential-ref) | `ANYSEARCH_API_KEY` | Credential reference resolved per call. |
| `baseURL` | string | `https://api.anysearch.com` | `/mcp` is appended. |
| `maxResults` | int | — | Seam provider default result count. |
| `enableProvider` | bool | `true` | Register the `anysearch` web-search provider. |
| `enabledDomains` | string[] | all | Domains that get an `anysearch_<domain>` tool. |

Environment fallbacks: `$ANYSEARCH_API_KEY` and `$ANYSEARCH_BASE_URL`.

To obtain an API key, apply from the [Anysearch console → API Keys](https://www.anysearch.com/console/api-keys).

### Web UI settings card

The plugin also ships a settings card inside the DeepSeek Harness Web UI, so you can
configure and enable Anysearch without editing a composition file.

**Enabling the card**

1. Start the DSH Web UI (`pnpm dsh web`) and open **设置 → 插件 → 插件配置**.
2. Find the **Anysearch 搜索** card in the plugin list (it appears once the
   `web-search-anysearch` settings namespace is exposed to the client).
3. Expand the card, fill in the fields below, and click **保存** (Save). A successful
   save shows a "configured" badge; the stored key is never echoed back on a response.

**Card fields**

| Field | Kind | Notes |
|---|---|---|
| API Key | secret | The Anysearch credential. Prefer referencing it through `apiKeyEnv`/`ANYSEARCH_API_KEY`; the stored value never appears in responses. |
| `apiKeyEnv` | text | Credential reference (default `ANYSEARCH_API_KEY`). |
| `baseURL` | text | Default `https://api.anysearch.com`. |
| `maxResults` | number | Default result count for the seam provider. |
| `enabledDomains` | multi-select | The 17 vertical tags; each checked one gets an `anysearch_<domain>` tool. |

**After saving**

- Saving applies immediately (live-apply); the card fields themselves need no restart.
- To use Anysearch as the underlying `web_search` backend, keep `web`'s
  `searchProvider: anysearch` (see the example below).

> The card is an *additive* client surface over the same config a composition file
> writes. Prefer one source at a time, or keep both consistent.

### Example (base composition overlay)

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: anysearch

- id: web-search-anysearch
  name: '@deepseek-ai/dsh-web-search-anysearch'
  config:
    apiKeyEnv: ANYSEARCH_API_KEY
    enabledDomains: [general, finance, academic, security, code, legal]
```

### Model experience

#### `anysearch_<domain>` search tools

**What the model sees:** each enabled vertical registers one `anysearch_<domain>` tool,
e.g. `anysearch_finance`, `anysearch_security`, or `anysearch_legal`. The tool accepts a
`query`, a `sub_domain` tag, optional `params` (key=value or JSON), and `max_results`, and
returns the raw Anysearch Markdown for that tag family — structured finance, security,
legal, and academic data included.

**Token effect:** result tokens are data-dependent and resent until compaction;
`max_results` bounds the returned source count.

**KV Cache effect:** append-only; each call is an independent network read whose output
follows the reusable request prefix and does not invalidate existing KV-cache entries.

#### `anysearch_domains`

**What the model sees:** the tool takes comma-separated `domains` (up to 5) and returns
the Markdown tag directory for each, listing `sub_domain` values and their required
parameters — for example `type=stock,symbol=...,cn_code=` for `finance.quote`.

**Token effect:** fixed, small schema plus a data-dependent directory result resent until
compaction.

**KV Cache effect:** prefix-stable while the package and directory text are unchanged; the
result appends after the reusable prefix.

#### `anysearch_batch`

**What the model sees:** the tool takes 2–5 `queries`, each `{ query, domain?,
sub_domain?, sub_domain_params?, max_results? }`, runs them in parallel, and returns the
merged Markdown results.

**Token effect:** data-dependent merged results resent until compaction; the request query
objects remain in call history.

**KV Cache effect:** append-only; individual queries follow the reusable request prefix
and do not invalidate existing KV-cache entries.

#### Failure shape

**What the model sees:** transport/API failures surface as `Error: <message>` with
`WebError` code `WEB_PROVIDER_ERROR`; cancellation surfaces as `Error: Anysearch call
aborted` with code `WEB_ABORTED`.

**Token effect:** only the failing call adds these retained tokens.

**KV Cache effect:** append-only; newly visible error content follows the reusable request
prefix.

### Known limitations and deferred work

- **Vertical results are opaque Markdown, not structured JSON** — the model must read the
  table/fields the backend returns for a given tag; this preserves backend fidelity but
  trades away per-field typing.
- **`params` validation is deferred to the Anysearch backend** — a missing required
  parameter for a tag surfaces as a backend error at call time rather than being rejected
  by the tool schema up front.
- **The general provider's `sources` are parsed from Markdown links only** — any answer
  text without hyperlinks stays inside `content` and produces an empty `sources[]`, so the
  seam's general provider is best used through the dedicated `anysearch_general` tool.
- **Rate limits** — anonymous access has lower limits; set `ANYSEARCH_API_KEY` for higher
  throughput.

---

## License

MIT. See [LICENSE](./LICENSE).
