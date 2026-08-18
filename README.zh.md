# dsh-anysearch-plugin

[![CI](https://github.com/gsh150801/dsh-anysearch-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/gsh150801/dsh-anysearch-plugin/actions/workflows/ci.yml) · [![dsh-plugin](https://img.shields.io/badge/dsh--plugin-DeepSeek%20Harness-2766c0)](https://github.com/topics/dsh-plugin)

> **其他语言:** [English](README.md) · [简体中文](README.zh.md)
>
> 本仓库是一个 **DeepSeek Harness 插件**（`dsh-plugin`）。为提高可发现性，请在您的插件
> 仓库中为仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 主题标签
> （参见 [DeepSeek Harness 文档](https://github.com/deepseek-ai/deepseek-harness)）。

---

## 1. 插件介绍

这是一个基于 **[Anysearch](https://anysearch.com)** 的搜索插件，运行在
[**DeepSeek Harness**](https://github.com/deepseek-ai/deepseek-harness) 的 Web 能力接缝
（`ctx.web`）上。它是一个自包含的 **Cordis 插件**：可作为外部 npm 包安装到任意 DSH
组合（composition）中。

它通过同一个 Anysearch JSON-RPC 端点提供三方面能力：

1. **一个 `WebSearchProvider`**（`id: anysearch`），注册到 `ctx.web` 的通用（无标签）垂直领域
   —— 选中后可作为标准的 `web_search` 后端。
2. **每个垂直领域一个模型工具** —— 覆盖全部 17 个领域的 `anysearch_<domain>`
   （`finance`、`security`、`legal`、`academic`、`health`、`code`、`ip` 等）。
3. **辅助工具** —— `anysearch_domains`（标签目录 + 必填参数）和 `anysearch_batch`
   （并行运行 2–5 个查询，返回合并后的 Markdown）。

### 工具

| 工具 | 用途 |
|---|---|
| `anysearch_<domain>` | 针对一个标签家族的垂直搜索。参数：`query`、`sub_domain`（标签）、`params`（key=value 或 JSON）、`max_results`（1–10）。 |
| `anysearch_domains` | 发现 1–5 个领域的标签目录（sub_domain + 必填参数）。 |
| `anysearch_batch` | 在多个领域/标签上并行运行 2–5 个查询；返回合并的 Markdown。 |

当不确定某个领域需要哪个 `sub_domain` 标签或必填 `params` 时，请先调用
`anysearch_domains`。

---

## 2. 插件安装

### 安装到 DSH

该包是一个普通的 Cordis 插件。安装 npm 包，并在您的 harness 组合（`cordis.yml` /
agent preset）中添加一行：

```yaml
- id: web-search-anysearch
  name: '@deepseek-ai/dsh-web-search-anysearch'
  config:
    apiKeyEnv: ANYSEARCH_API_KEY       # 可选；允许匿名访问（速率更低）
    enabledDomains:
      - general
      - finance
      - security
      - legal
      - academic
```

要把 Anysearch 用作底层 `web_search` 后端，请同时设置 `web` 提供方：

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: anysearch
```

`enabledDomains` 默认为**全部 17 个领域**；省略或传入空数组即可获得每个垂直领域的工具。
设置 `ANYSEARCH_API_KEY` 可获得更高的吞吐（可选）。

### 从源码开发

```sh
npm install          # 安装 peer + dev 依赖（dsh-* 包在 npm 上发布）
npm run typecheck
npm run build        # tsc -> lib/
npm test             # vitest
```

---

## 3. 配置与使用

### 组合（composition）配置

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `apiKeyEnv` | string (credential-ref) | `ANYSEARCH_API_KEY` | 每次调用时解析的凭据引用。 |
| `baseURL` | string | `https://api.anysearch.com` | 会追加 `/mcp`。 |
| `maxResults` | int | — | seam 提供方的默认结果数。 |
| `enableProvider` | bool | `true` | 是否注册 `anysearch` web 搜索提供方。 |
| `enabledDomains` | string[] | 全部 | 为其注册 `anysearch_<domain>` 工具的领域。 |

环境变量回退：`$ANYSEARCH_API_KEY` 和 `$ANYSEARCH_BASE_URL`。

### Web UI 设置卡片

该插件还在 DeepSeek Harness Web UI 中提供一张「设置卡片」，无需编辑组合文件即可配置并启用
Anysearch。

**启用步骤**

1. 启动 DSH Web UI（`pnpm dsh web`），打开 **设置 → 插件 → 插件配置**。
2. 在插件列表中找到 **Anysearch 搜索** 卡片（当 `web-search-anysearch` 设置命名空间暴露给
   客户端时会出现）。
3. 展开卡片，填写下面的字段，然后点击 **保存**。保存成功后会显示「已配置」标记；已存储的
   密钥绝不会在响应中回显。

**卡片字段**

| 字段 | 类型 | 说明 |
|---|---|---|
| API Key | 机密（secret） | Anysearch 凭据。建议通过 `apiKeyEnv` / `ANYSEARCH_API_KEY` 引用；已存值不会出现在响应中。 |
| `apiKeyEnv` | 文本 | 凭据引用（默认 `ANYSEARCH_API_KEY`）。 |
| `baseURL` | 文本 | 默认 `https://api.anysearch.com`。 |
| `maxResults` | 数字 | seam 提供方的默认结果数。 |
| `enabledDomains` | 多选 | 17 个垂直领域标签；每个勾选的会获得对应的 `anysearch_<domain>` 工具。 |

**保存之后**

- 保存后立即生效（live-apply），卡片字段本身无需重启。
- 若要用作底层 `web_search` 后端，请保持 `web` 提供方的 `searchProvider: anysearch`
  （见下方示例）。

> 该卡片是*增量式*客户端界面，与组合文件写入相同的配置。建议同一时间只使用一种来源，
> 或保持两者一致。

### 示例（基础组合叠加）

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

### 模型体验

#### `anysearch_<domain>` 搜索工具

**模型所见：** 每个启用的垂直领域都会注册一个 `anysearch_<domain>` 工具，例如
`anysearch_finance`、`anysearch_security` 或 `anysearch_legal`。该工具接受 `query`、一个
`sub_domain` 标签、可选的 `params`（key=value 或 JSON）以及 `max_results`，并返回该标签
家族的原始 Anysearch Markdown——包括结构化的金融、安全、法律和学术数据。

**Token 影响：** 结果 Token 随数据变化，并在压缩前反复发送；`max_results` 限制了返回源
的数量。

**KV 缓存影响：** 仅追加；每次调用都是一次独立的网络读取，其输出跟在可复用请求前缀之后，
并使现有 KV-cache 条目保持有效。

#### `anysearch_domains`

**模型所见：** 该工具接收逗号分隔的 `domains`（最多 5 个），并返回每个领域的 Markdown 标签
目录，列出 `sub_domain` 值及其必填参数——例如 `finance.quote` 的
`type=stock,symbol=...,cn_code=`。

**Token 影响：** 固定的小型 schema 加上随数据变化的目录结果，在压缩前反复发送。

**KV 缓存影响：** 只要包和目录文本不变，前缀即稳定；结果追加在可复用前缀之后。

#### `anysearch_batch`

**模型所见：** 该工具接收 2–5 个 `queries`，每个为 `{ query, domain?, sub_domain?,
sub_domain_params?, max_results? }`，并行运行，并返回合并后的 Markdown 结果。

**Token 影响：** 随数据变化的合并结果在压缩前反复发送；请求查询对象保留在调用历史中。

**KV 缓存影响：** 仅追加；单个查询跟在可复用请求前缀之后，不会使现有 KV-cache 条目失效。

#### 失败形态

**模型所见：** 传输/API 失败显示为 `Error: <message>`，`WebError` 错误码为
`WEB_PROVIDER_ERROR`；取消显示为 `Error: Anysearch call aborted`，错误码为
`WEB_ABORTED`。

**Token 影响：** 只有失败的调用会新增这些保留 Token。

**KV 缓存影响：** 仅追加；新出现的错误内容跟在可复用请求前缀之后。

### 已知限制与待办工作

- **垂直结果是不透明的 Markdown，而非结构化 JSON** —— 模型必须阅读后端针对某个标签
  返回的表格/字段；这保持了后端保真度，但放弃了逐字段的类型。
- **`params` 校验交由 Anysearch 后端执行** —— 标签缺少必填参数时，会在调用时作为后端
  错误暴露，而不是由工具 schema 预先拒绝。
- **通用提供方的 `sources` 仅从 Markdown 链接解析** —— 没有超链接的回答文本会保留在
  `content` 中，并产生空的 `sources[]`；因此 seam 的通用提供方最好通过专用的
  `anysearch_general` 工具使用。
- **速率限制** —— 匿名访问上限较低；设置 `ANYSEARCH_API_KEY` 可获得更高吞吐。

---

## 许可证

MIT。参见 [LICENSE](./LICENSE)。
