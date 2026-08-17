/**
 * The Anysearch search provider's card: its credential, its reference, its
 * endpoint, its default result count, and the set of vertical tags whose
 * `anysearch_<domain>` tools are registered. The credential writes through a
 * {@link CardSecretSpec} so the literal never rides a response.
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SecretField, ValueField } from './fields.tsx'
import { TagsField } from './tags-field.tsx'
import { PluginCard } from './PluginCard.tsx'
import { ANYSEARCH_TAGS, type AnysearchCardFace } from './anysearch-card-controller.ts'
import type {} from './slot-contract.ts'

/** Props the renderer binds for the Anysearch card. */
export type AnysearchCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<AnysearchCardFace>

/**
 * Render the Anysearch card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function AnysearchCard(props: AnysearchCardProps) {
  const { t } = props
  const state = props.useAnysearchCard(snapshot => snapshot)
  const disabled = !state.writable
  return (
    <PluginCard
      t={t}
      titleKey="anysearchTitle"
      descriptionKey="anysearchDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <SecretField
        id="plugin-config-anysearch-key"
        label={t('anysearchApiKey')}
        hint={t('anysearchApiKeyHint')}
        disabled={!state.apiKeyWritable}
        text={state.apiKey.text}
        configured={state.apiKeyConfigured}
        stateLabel={state.apiKeyConfigured ? t('anysearchApiKeySet') : t('anysearchApiKeyUnset')}
        onEdit={(text) => { props.edit('apiKey', text) }}
      />
      <ValueField
        id="plugin-config-anysearch-key-env"
        label={t('anysearchApiKeyEnv')}
        hint={t('anysearchApiKeyEnvHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.apiKeyEnv}
        onEdit={(text) => { props.edit('apiKeyEnv', text) }}
        onReset={() => { props.resetField('apiKeyEnv') }}
      />
      <ValueField
        id="plugin-config-anysearch-endpoint"
        label={t('anysearchBaseUrl')}
        hint={t('anysearchBaseUrlHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.baseURL}
        onEdit={(text) => { props.edit('baseURL', text) }}
        onReset={() => { props.resetField('baseURL') }}
      />
      <ValueField
        id="plugin-config-anysearch-max-results"
        label={t('anysearchMaxResults')}
        hint={t('anysearchMaxResultsHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        numeric
        disabled={disabled}
        {...state.maxResults}
        onEdit={(text) => { props.edit('maxResults', text) }}
        onReset={() => { props.resetField('maxResults') }}
      />
      <TagsField
        id="plugin-config-anysearch-domains"
        label={t('anysearchDomains')}
        hint={t('anysearchDomainsHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        validTags={ANYSEARCH_TAGS}
        {...state.enabledDomains}
        onEdit={(text) => { props.edit('enabledDomains', text) }}
        onReset={() => { props.resetField('enabledDomains') }}
      />
    </PluginCard>
  )
}