/**
 * The Anysearch card's staged form over the `web-search-anysearch` settings
 * namespace.
 *
 * The apiKey literal is written directly into the section via a
 * {@link CardSecretSpec}; everything else (`apiKeyEnv`, `baseURL`,
 * `maxResults`, `enabledDomains`) flows through ordinary section fields.
 * `enabledDomains` is the only multi-valued control: it stages a
 * comma-separated string and the {@link tagsField} spec parses it back into
 * the `string[]` the section stores.
 */

import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import {
  CardForm, numberField, textField,
  type CardActions, type CardFieldState, type CardSecretSpec, type CardShell,
} from './card-form.ts'
import { tagsField } from './tags-field.tsx'

/**
 * Namespace of the Anysearch search provider. Spelled here rather than
 * imported: a client package must not depend on a Host package.
 */
export const ANYSEARCH_NS = 'web-search-anysearch'

/** The complete set of vertical tags Anysearch exposes. */
export const ANYSEARCH_TAGS: readonly string[] = [
  'general',
  'resource',
  'social_media',
  'finance',
  'academic',
  'legal',
  'health',
  'business',
  'security',
  'ip',
  'code',
  'energy',
  'environment',
  'agriculture',
  'travel',
  'film',
  'gaming',
]

/** Form field the credential control stages under. */
const API_KEY_FIELD = 'apiKey'

/** The Anysearch fields this card edits. */
export interface AnysearchSettings {
  /** Credential literal; written through the secret spec, never read back. */
  apiKey?: string
  /** Credential reference naming the environment key. */
  apiKeyEnv?: string
  /** Provider endpoint; blank inherits the provider default. */
  baseURL?: string
  /** Default result count when a request carries no `maxResults`. */
  maxResults?: number
  /** Domains that get an `anysearch_<domain>` tool. */
  enabledDomains?: string[]
}

/** What the Anysearch card renders. */
export interface AnysearchCardState extends CardShell {
  /** Credential reference env name. */
  apiKeyEnv: CardFieldState
  /** Provider endpoint. */
  baseURL: CardFieldState
  /** Default result count. */
  maxResults: CardFieldState
  /** Selected vertical tags. */
  enabledDomains: CardFieldState
  /** The staged credential, which starts blank on every load. */
  apiKey: CardFieldState
  /** Whether the Host reports a configured credential for this namespace. */
  apiKeyConfigured: boolean
  /** Whether the credentials domain accepts a write for it; false disables the control. */
  apiKeyWritable: boolean
}

/** The registration-side face the Anysearch card's slot entry injects. */
export interface AnysearchCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useAnysearchCard. */
    anysearchCard: SnapshotStore<AnysearchCardState>
  }
}

/** Bridges the `web-search-anysearch` scope onto the card. */
export class AnysearchCardController {
  private readonly form: CardForm<AnysearchSettings>
  private readonly store: SnapshotStore<AnysearchCardState>

  /**
   * @param scope - the bound settings scope for the `web-search-anysearch` namespace.
   */
  constructor(private readonly scope: SettingsScope<AnysearchSettings>) {
    const secrets: CardSecretSpec[] = [{
      field: API_KEY_FIELD,
      write: async (value) => {
        await this.scope.set(API_KEY_FIELD, value)
        return this.isApiKeyConfigured()
      },
    }]
    this.form = new CardForm(
      scope,
      [
        textField('apiKeyEnv'),
        textField('baseURL'),
        numberField('maxResults'),
        tagsField('enabledDomains', ANYSEARCH_TAGS),
      ],
      secrets,
    )
    this.store = this.form.bind(() => this.projection())
  }

  /**
   * Read a projection of this card's state.
   * @returns the form state plus the four section fields, the secret control,
   * and whether the credential is configured and writable.
   */
  private projection(): AnysearchCardState {
    const snapshot = this.scope.getSnapshot()
    const user = snapshot.user as Record<string, unknown> | undefined
    return {
      ...this.form.shell(),
      apiKeyEnv: this.form.field('apiKeyEnv'),
      baseURL: this.form.field('baseURL'),
      maxResults: this.form.field('maxResults'),
      enabledDomains: this.form.field('enabledDomains'),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: user !== undefined && Object.hasOwn(user, API_KEY_FIELD),
      apiKeyWritable: snapshot.writable,
    }
  }

  /**
   * Whether the Host holds an apiKey the user has configured.
   *
   * The settings provider redacts the secret in any value the card reads, so
   * the user layer is the source — its presence is the only signal, not its
   * literal.
   */
  private isApiKeyConfigured(): boolean {
    const user = this.scope.getSnapshot().user as Record<string, unknown> | undefined
    return user !== undefined && Object.hasOwn(user, API_KEY_FIELD)
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): AnysearchCardFace {
    return { hooks: { anysearchCard: this.store }, ...this.form.actions() }
  }
}