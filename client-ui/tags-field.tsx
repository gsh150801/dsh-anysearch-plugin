/**
 * A multi-select field rendered as a checkbox grid. Stages a comma-separated
 * string so it reuses the card form's string edit; the {@link tagsField} spec
 * parses that string back into the `string[]` the section stores.
 *
 * Valid tags are declared at construction. A tag typed into the draft that is
 * not in `validTags` is dropped on parse, so a stale value cannot sneak back
 * in via a copied draft.
 */

import type { CardFieldSpec } from './card-form.ts'
import css from './fields.module.css'

/**
 * A field whose stored value is one of `validTags` per entry. The card renders
 * a checkbox per valid tag; toggling rebuilds the comma-separated draft.
 * @param field - field name inside the namespace section.
 * @param validTags - the complete set of tags the field may carry.
 * @returns the field's conversion spec.
 */
export function tagsField(field: string, validTags: readonly string[]): CardFieldSpec {
  return {
    field,
    format: value => Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string' && validTags.indexOf(v) >= 0).join(',')
      : '',
    parse: text => {
      const tags = text.split(',').map(s => s.trim()).filter(s => s.length > 0)
        .filter(s => validTags.indexOf(s) >= 0)
      return tags.length === 0 ? { kind: 'clear' as const } : { kind: 'set' as const, value: tags }
    },
  }
}

/** The shared field chrome every checkbox grid uses. */
export interface TagsFieldProps {
  /** Stable id associating the label group with its control. */
  id: string
  /** Visible label. */
  label: string
  /** One-line explanation rendered under the control. */
  hint: string
  /** Draft text (comma-separated selected tags) the control renders. */
  text: string
  /** True when saving would leave a user-layer entry for this field. */
  overridden: boolean
  /** True when the draft is not a value this field accepts. */
  invalid: boolean
  /** Copy for the overridden badge. */
  overriddenLabel: string
  /** Copy for the reset control. */
  resetLabel: string
  /** Copy shown in place of the hint while the draft is invalid. */
  invalidLabel: string
  /** Disables every control (read-only document, or an unavailable namespace). */
  disabled: boolean
  /** The complete set of tags the user may can select. */
  validTags: readonly string[]
  /** Stage draft text. */
  onEdit: (text: string) => void
  /** Stage a clear so the field re-inherits the composition layer. */
  onReset: () => void
}

/**
 * Render a checkbox grid for one tags field. The visible draft is the
 * comma-separated string the card form stages; the grid rebuilds it on every
 * toggle and hands the new string back through `onEdit`.
 * @param props - the field's copy, its staged text, the valid tags, and edits.
 * @returns the labelled checkbox grid.
 */
export function TagsField(props: TagsFieldProps) {
  const labelId = `${props.id}-label`
  const selected = new Set(
    props.text.split(',').map(s => s.trim()).filter(s => s.length > 0)
      .filter(t => props.validTags.indexOf(t) >= 0)
  )
  function toggle(tag: string, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(tag); else next.delete(tag)
    props.onEdit(Array.from(next).join(','))
  }
  return (
    <div className={css.field}>
      <div className={css.head}>
        <span id={labelId} className={css.label}>{props.label}</span>
        {props.overridden
          ? (
            <span className={css.badges}>
              <span className={css.badge}>{props.overriddenLabel}</span>
              <button
                type="button"
                className={css.reset}
                disabled={props.disabled}
                onClick={props.onReset}
              >
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      <div
        role="group"
        id={props.id}
        aria-labelledby={labelId}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '4px 12px',
          marginTop: 6,
        }}
      >
        {props.validTags.map(tag => (
          <label
            key={tag}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <input
              type="checkbox"
              disabled={props.disabled}
              checked={selected.has(tag)}
              onChange={event => { toggle(tag, event.target.checked) }}
            />
            {tag}
          </label>
        ))}
      </div>
      <p className={props.invalid ? css.invalid : css.hint}>
        {props.invalid ? props.invalidLabel : props.hint}
      </p>
    </div>
  )
}