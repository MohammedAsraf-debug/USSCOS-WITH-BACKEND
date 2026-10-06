import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, ExternalLink, Plus, Save, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../../components/admin/PageHeader.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import { TextAreaInput } from '../../components/admin/FormInput.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useContentBlock } from '@/hooks/use-firestore'
import { useAdminContentBlockMutation } from '@/hooks/use-admin-mutations'
import { blockDefaults, getContentPage } from '../../features/admin/content-pages.js'

/** Parse a stored JSON array, falling back to the block defaults. */
function parseList(value, fallback) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Malformed stored JSON — keep the safe defaults.
    }
  }
  return fallback
}

/** Merge a stored block over its defaults, parsing repeated content arrays. */
function mergeBlock(remote, defaults) {
  const merged = { ...defaults }
  if (remote && typeof remote === 'object') {
    for (const key of Object.keys(defaults)) {
      if (Array.isArray(defaults[key])) {
        merged[key] = parseList(remote[key], defaults[key])
      } else if (typeof remote[key] === 'string') {
        merged[key] = remote[key]
      }
    }
  }
  return merged
}

/**
 * contentBlocks stores a flat string map, so repeated content is serialised as
 * JSON before it is written and parsed again on read.
 */
function serializeBlock(values) {
  const payload = {}
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) payload[key] = JSON.stringify(value)
    else payload[key] = typeof value === 'string' ? value : String(value ?? '')
  }
  return payload
}

export default function AdminContentPage() {
  const { pageId } = useParams()
  const page = getContentPage(pageId)

  if (!page) {
    return (
      <>
        <PageHeader
          title="Page not found"
          subtitle="This page is not part of the website content manager."
        />
        <Link to="/admin/content" className="content-editor__back">
          <ArrowLeft size={16} /> Back to Website Content
        </Link>
      </>
    )
  }

  return <PageEditor key={page.id} page={page} />
}

function PageEditor({ page }) {
  return (
    <>
      <div className="content-editor__topbar">
        <Link to="/admin/content" className="content-editor__back">
          <ArrowLeft size={16} /> Back to Website Content
        </Link>
        <a className="content-editor__view" href={page.route} target="_blank" rel="noreferrer">
          View page <ExternalLink size={14} />
        </a>
      </div>

      <PageHeader title={page.label} subtitle={page.description} />

      {page.manage?.length > 0 && (
        <div className="content-editor__manage">
          <span className="content-editor__manage-label">Individual records:</span>
          {page.manage.map((link) => (
            <Link key={link.to} to={link.to} className="content-editor__manage-link">
              {link.label} <ArrowRight size={14} />
            </Link>
          ))}
        </div>
      )}

      <div className="content-editor__blocks">
        {page.blocks.map((block) => (
          <BlockEditor key={block.id} block={block} />
        ))}
      </div>
    </>
  )
}

function BlockEditor({ block }) {
  const { showToast } = useToast()
  const query = useContentBlock(block.id)
  const saveMutation = useAdminContentBlockMutation(block.id)
  const defaults = blockDefaults(block.id)

  const [values, setValues] = useState(defaults)
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    if (synced || query.status !== 'success') return
    setValues(mergeBlock(query.data ?? null, defaults))
    setSynced(true)
  }, [synced, query.status, query.data, defaults])

  const setField = (key, value) => setValues((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    const result = await saveMutation.save(serializeBlock(values))
    if (!result.ok) {
      showToast(`Could not save ${block.title}: ${result.message || result.reason}`, 'error')
      return
    }
    showToast(`${block.title} saved`, 'success')
  }

  if (query.isLoading) {
    return (
      <div className="admin-card">
        <LoadingState label={`Loading ${block.title}`} />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="admin-card" role="alert">
        <h3>{block.title}</h3>
        <p className="content-editor__error">
          {query.error instanceof Error
            ? query.error.message
            : 'This content could not be loaded. Please try again.'}
        </p>
        <SecondaryButton onClick={() => void query.refetch()}>TRY AGAIN</SecondaryButton>
      </div>
    )
  }

  return (
    <div className="admin-card">
      <div className="content-editor__block-head">
        <h3>{block.title}</h3>
        <PrimaryButton onClick={handleSave} disabled={!synced || saveMutation.isPending}>
          <Save size={16} /> {saveMutation.isPending ? 'SAVING…' : 'SAVE'}
        </PrimaryButton>
      </div>

      <div className={block.layout === 'grid' ? 'content-editor__grid' : 'content-editor__fields'}>
        {block.fields.map((field) => (
          <div key={field.key} className="content-editor__field">
            <TextAreaInput
              label={field.label}
              name={`${block.id}-${field.key}`}
              value={values[field.key] ?? ''}
              onChange={(e) => setField(field.key, e.target.value)}
              rows={field.rows ?? 1}
            />
            {field.richText && (
              <span className="content-editor__hint">
                Wrap highlighted words in **double asterisks**. Press Enter for a line break.
              </span>
            )}
          </div>
        ))}
      </div>

      {block.lists?.map((list) => (
        <ListEditor
          key={list.key}
          list={list}
          items={Array.isArray(values[list.key]) ? values[list.key] : []}
          onChange={(items) => setField(list.key, items)}
        />
      ))}
    </div>
  )
}

function ListEditor({ list, items, onChange }) {
  const updateItem = (index, key, value) => {
    const next = items.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    onChange(next)
  }

  const addItem = () => onChange([...items, { ...(list.newItem ?? {}) }])

  const removeItem = (index) => onChange(items.filter((_, i) => i !== index))

  const moveItem = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <section className="content-editor__list">
      <div className="content-editor__list-head">
        <h4>{list.label}</h4>
        <button type="button" className="content-editor__list-add" onClick={addItem}>
          <Plus size={14} /> {list.addLabel ?? 'Add item'}
        </button>
      </div>

      {items.length === 0 && (
        <p className="content-editor__list-empty">No items yet. Add one to get started.</p>
      )}

      <div className="content-editor__list-items">
        {items.map((item, index) => (
          <article className="content-editor__list-item" key={index}>
            <header className="content-editor__list-item-head">
              <span className="content-editor__list-item-index">
                {(item[list.itemLabel] || `Item ${index + 1}`).toString()}
              </span>
              <div className="content-editor__list-item-actions">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Move down"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  className="content-editor__list-item-remove"
                  onClick={() => removeItem(index)}
                  aria-label="Remove item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </header>

            <div className="content-editor__list-item-fields">
              {list.fields.map((field) => (
                <TextAreaInput
                  key={field.key}
                  label={field.label}
                  name={`${list.key}-${index}-${field.key}`}
                  value={item[field.key] ?? ''}
                  onChange={(e) => updateItem(index, field.key, e.target.value)}
                  rows={field.rows ?? 1}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
