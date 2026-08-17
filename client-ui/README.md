# Anysearch Card — Client UI for DeepSeek Harness

This directory contains the client-side plugin card that exposes the Anysearch
search provider's settings inside the harness web UI under **设置 → 插件 → 插件配置**.

The card is implemented in the harness monorepo at
`packages/client/ui-settings-plugins/src/client/`. The three files in this
directory are the **additions** to that package; they import siblings that
already live there (`./card-form.ts`, `./fields.tsx`, `./PluginCard.tsx`,
`./locales.ts`, `./slot-contract.ts`) and therefore only make sense once
copied into the monorepo.

## Files

| File | Purpose |
|---|---|
| `AnysearchCard.tsx` | The card component: apiKey (secret), apiKeyEnv, baseURL, maxResults, enabledDomains (17-domain multi-select). Uses the shared `PluginCard` so its disclosure, save/discard footer, and dirty badge come for free. |
| `anysearch-card-controller.ts` | Binds the `web-search-anysearch` settings namespace. Stages edits through `CardForm`; the apiKey literal is a `CardSecretSpec` so it is never echoed back on a response. |
| `tags-field.tsx` | A reusable `TagsField` control (checkbox grid) plus a `tagsField` `CardFieldSpec` factory that round-trips between `string[]` (stored) and a comma-separated draft string (staged). |

## Two edits to existing files

The card also needs two small changes to existing files in
`packages/client/ui-settings-plugins/src/client/`.

### 1) `locales.ts` — extend the union and the bundles

Append to `PluginsSettingsLocaleKey`:

```ts
  | 'anysearchTitle' | 'anysearchDescription'
  | 'anysearchApiKey' | 'anysearchApiKeyHint' | 'anysearchApiKeySet' | 'anysearchApiKeyUnset'
  | 'anysearchApiKeyEnv' | 'anysearchApiKeyEnvHint'
  | 'anysearchBaseUrl' | 'anysearchBaseUrlHint'
  | 'anysearchMaxResults' | 'anysearchMaxResultsHint'
  | 'anysearchDomains' | 'anysearchDomainsHint'
```

Append to the `en` bundle:

```ts
  anysearchTitle: 'Anysearch',
  anysearchDescription: 'The Anysearch search provider and per-vertical domain tools.',
  anysearchApiKey: 'API key',
  anysearchApiKeyHint: 'Stored as a secret. Leave blank to keep the current key.',
  anysearchApiKeySet: 'A key is configured.',
  anysearchApiKeyUnset: 'No key is configured; anonymous access uses lower rate limits.',
  anysearchApiKeyEnv: 'Credential reference (env var)',
  anysearchApiKeyEnvHint: 'Environment variable name that resolves to the API key when no literal is set.',
  anysearchBaseUrl: 'Endpoint',
  anysearchBaseUrlHint: 'Leave blank to use the Anysearch default endpoint.',
  anysearchMaxResults: 'Default results per request',
  anysearchMaxResultsHint: 'Seam provider default result count when a request carries none.',
  anysearchDomains: 'Enabled vertical tags',
  anysearchDomainsHint: 'Each enabled vertical registers one anysearch_<domain> model tool.',
```

Append to the `zh` bundle:

```ts
  anysearchTitle: 'Anysearch 搜索',
  anysearchDescription: 'Anysearch 搜索提供方及按领域注册的工具。',
  anysearchApiKey: 'API Key',
  anysearchApiKeyHint: '作为密钥存储。留空表示保持当前密钥。',
  anysearchApiKeySet: '已配置密钥。',
  anysearchApiKeyUnset: '未配置密钥；匿名访问限流较低。',
  anysearchApiKeyEnv: '凭据引用（环境变量名）',
  anysearchApiKeyEnvHint: '当未设置字面量密钥时，解析该环境变量名得到 API Key。',
  anysearchBaseUrl: '接口地址',
  anysearchBaseUrlHint: '留空则使用 Anysearch 默认接口。',
  anysearchMaxResults: '单次请求默认结果数',
  anysearchMaxResultsHint: '当请求未指定 maxResults 时，作为 web 搜索后端的默认结果数。',
  anysearchDomains: '已启用的垂直标签',
  anysearchDomainsHint: '每个已启用垂直标签注册一个 anysearch_<domain> 模型工具。',
```

### 2) `index.ts` — register the card

Add imports:

```ts
import { AnysearchCard } from './AnysearchCard.tsx'
import { ANYSEARCH_NS, AnysearchCardController } from './anysearch-card-controller.ts'
```

Export the new types:

```ts
export type { AnysearchCardFace, AnysearchCardState, AnysearchSettings } from './anysearch-card-controller.ts'
```

Instantiate the controller inside `apply(ctx)` (right after the existing three):

```ts
const anysearch = new AnysearchCardController(ctx.settingsScope.bind({ namespace: ANYSEARCH_NS }))
```

Inside the existing `ctx.slots.inject('settings.plugin.item', function* () { … })`
generator, append a fourth registration (anywhere after `web-search`):

```ts
yield ctx.slots.register({
  name: 'settings.plugin.item',
  id: 'web-search-anysearch',
  order: 25,
  locale: NS,
  inject: () => anysearch.inject(),
}, AnysearchCard)
```

## Activation

After copying the three files and applying the two edits:

```sh
pnpm install
pnpm run build:lib:client
pnpm run gen-client-catalog   # regenerates packages/extensions/cordis-client-runner/src/client/slot-catalog.ts
```

Then restart the web profile (`pnpm dsh web`) so the rebuilt `lib/` is loaded.
The **Anysearch** card appears under 设置 → 插件 → 插件配置 alongside Bash, Agent
loop, and Web search.

## Why a separate repository?

The host half of the Anysearch plugin (`@deepseek-ai/dsh-web-search-anysearch`,
published to npm from the root of this repo) does not own client-side UI —
the harness loads client modules from `packages/client/*` in the monorepo.
The card therefore lives in the monorepo, and this directory documents the
additions for that monorepo's `ui-settings-plugins` package so a maintainer
can review and apply them as a single patch.

## License

MIT — same as the rest of this repo.