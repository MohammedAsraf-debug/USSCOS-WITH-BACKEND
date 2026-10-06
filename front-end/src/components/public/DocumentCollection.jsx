import { useRef, useState } from 'react'
import {
  Upload,
  FileText,
  X,
  Check,
  RefreshCw,
  ShieldCheck,
  Plus,
} from 'lucide-react'
import {
  ACCEPTED_DOCUMENT_LABEL,
  formatFileSize,
  MAX_DOCUMENT_BYTES,
} from '@/lib/documents'

function FileChip({ entry, category, onReplace, onRemove }) {
  return (
    <div className="document-chip">
      <span className="document-chip__file">
        <FileText size={18} />
        <span className="document-chip__meta">
          <span className="document-chip__name">{entry.fileName}</span>
          <span className="document-chip__size">
            {entry.status === 'recorded'
              ? 'Attached — secure upload pending'
              : entry.status === 'ready'
                ? 'Uploaded securely'
                : 'Preparing…'}{' '}
            · {formatFileSize(entry.fileSizeBytes)}
          </span>
        </span>
      </span>
      <span className="document-chip__actions">
        <span className="document-chip__ok" aria-label="File accepted">
          <Check size={16} />
        </span>
        {!category.multiple && (
          <button
            type="button"
            className="document-chip__action"
            onClick={onReplace}
            aria-label={`Replace ${entry.fileName}`}
            title="Replace file"
          >
            <RefreshCw size={16} /> Replace
          </button>
        )}
        <button
          type="button"
          className="document-chip__action document-chip__action--remove"
          onClick={onRemove}
          aria-label={`Remove ${entry.fileName}`}
          title="Remove file"
        >
          <X size={16} /> Remove
        </button>
      </span>
    </div>
  )
}

export default function DocumentCollection({
  categories,
  documents,
  typesByCategory,
  errors = {},
  onTypeChange,
  onAttachFile,
  onRemove,
  privacyNote = (
    <>
      <ShieldCheck size={16} />
      <span>
        Files are validated and recorded with your application as{' '}
        <strong>private documents</strong>. They are never uploaded publicly;
        secure document upload connects when available.
      </span>
    </>
  ),
}) {
  const [busyCategory, setBusyCategory] = useState(null)
  const [dragCategory, setDragCategory] = useState(null)
  const inputRefs = useRef({})

  const entriesFor = (id) => documents.filter((d) => d.documentCategory === id)

  const openPicker = (id) => inputRefs.current[id]?.click()

  const handleAttach = async (categoryId, file) => {
    if (!file) return
    setBusyCategory(categoryId)
    try {
      await onAttachFile(categoryId, file)
    } finally {
      setBusyCategory(null)
    }
  }

  const onInputChange = async (categoryId, e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    await handleAttach(categoryId, file)
  }

  const onDrop = (categoryId, e) => {
    e.preventDefault()
    setDragCategory(null)
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
    handleAttach(categoryId, file)
  }

  return (
    <div className="document-collection">
      <div className="document-collection__privacy">{privacyNote}</div>

      {categories.map((category) => {
        const entries = entriesFor(category.id)
        const canAddMore = entries.length < (category.maxFiles ?? 1)
        const showFullPicker = entries.length === 0

        return (
          <div className="document-slot" key={category.id}>
            <div className="document-slot__head">
              <div className="document-slot__title">
                <h4>{category.label}</h4>
                {category.required ? (
                  <span className="document-slot__badge document-slot__badge--required">
                    Required *
                  </span>
                ) : (
                  <span className="document-slot__badge document-slot__badge--optional">
                    Optional
                  </span>
                )}
              </div>
              {category.description && (
                <p className="document-slot__desc">{category.description}</p>
              )}
            </div>

            {category.types && (
              <div className="form-field">
                <label htmlFor={`doc-type-${category.id}`}>
                  Select {category.required ? 'ID' : 'document'} type
                </label>
                <select
                  id={`doc-type-${category.id}`}
                  className="form-input"
                  value={typesByCategory[category.id] ?? ''}
                  onChange={(e) => onTypeChange(category.id, e.target.value)}
                  aria-label={`${category.label} type`}
                >
                  <option value="">Select…</option>
                  {category.types.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {category.examples && (
              <p className="document-slot__hint">{category.examples.join(' · ')}</p>
            )}

            {entries.map((entry) => (
              <FileChip
                key={entry.id}
                entry={entry}
                category={category}
                onReplace={() => openPicker(category.id)}
                onRemove={() => onRemove(category.id, entry)}
              />
            ))}

            {busyCategory === category.id && (
              <div className="document-slot__busy">Preparing your file…</div>
            )}

            {canAddMore && busyCategory !== category.id && (
              <button
                type="button"
                className={
                  showFullPicker
                    ? 'document-dropzone'
                    : 'document-dropzone document-dropzone--compact'
                }
                aria-label={`Choose file for ${category.label}`}
                onClick={() => openPicker(category.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragCategory(category.id)
                }}
                onDragLeave={() => setDragCategory(category.id === dragCategory ? null : dragCategory)}
                onDrop={(e) => onDrop(category.id, e)}
                data-dragging={dragCategory === category.id}
              >
                <span className="document-dropzone__icon">
                  <Upload size={showFullPicker ? 28 : 18} />
                </span>
                <span className="document-dropzone__text">
                  {showFullPicker ? (
                    <>
                      <span className="document-dropzone__title">Choose File</span>
                      <span className="document-dropzone__sub">
                        {ACCEPTED_DOCUMENT_LABEL} · max{' '}
                        {formatFileSize(MAX_DOCUMENT_BYTES)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />{' '}
                      {category.id === 'additional'
                        ? 'Add another document'
                        : 'Add another file'}
                    </>
                  )}
                </span>
              </button>
            )}

            <input
              key={`input-${canAddMore}`}
              type="file"
              data-testid={`upload-${category.id}`}
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              aria-label={`Upload ${category.label}`}
              style={{ display: 'none' }}
              ref={(el) => {
                inputRefs.current[category.id] = el
              }}
              onChange={(e) => onInputChange(category.id, e)}
            />

            {errors[category.id] && (
              <span className="form-field__error" role="alert">
                {errors[category.id]}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}