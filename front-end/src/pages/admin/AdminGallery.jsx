import { useState } from 'react'
import { Plus, Trash2, Edit, Upload, Play } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import Modal from '../../components/common/Modal.jsx'
import ConfirmModal from '../../components/common/ConfirmModal.jsx'
import FormInput from '../../components/common/FormInput.jsx'
import FormSelect from '../../components/admin/FormSelect.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { useAdminGallery, useAdminEvents } from '@/hooks/use-firestore'
import { useAdminMutation } from '@/hooks/use-admin-mutations'
import { useToast } from '../../context/ToastContext.jsx'
import { isVideoUrl } from '../../lib/media'
import {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  uploadToCloudinary,
  validateMediaFile,
} from '@/services/media/cloudinary'

const ACCEPTED_MEDIA = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(',')

const emptyForm = {
  title: '',
  caption: '',
  category: 'Events',
  mediaKind: 'image',
  publicUrl: '',
  eventId: '',
}

export default function AdminGallery() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadName, setUploadName] = useState('')
  const [uploadError, setUploadError] = useState('')
  const { showToast } = useToast()
  const { data: galleryItems, isLoading } = useAdminGallery()
  const { data: events } = useAdminEvents()
  const { create, update, remove } = useAdminMutation('galleryImages')

  const items = galleryItems ?? []
  const eventOptions = (events ?? []).map((ev) => ({ value: ev.id, label: ev.title }))

  const resetUpload = () => {
    setUploading(false)
    setUploadProgress(0)
    setUploadName('')
    setUploadError('')
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setErrors({})
    resetUpload()
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditingId(item.id)
    setForm({
      title: item.title || item.altText || '',
      caption: item.altText || '',
      category: item.category || 'Events',
      mediaKind: isVideoUrl(item.publicUrl) ? 'video' : 'image',
      publicUrl: item.publicUrl || '',
      eventId: item.eventId || '',
    })
    setErrors({})
    resetUpload()
    setModalOpen(true)
  }

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validation = validateMediaFile(file)
    if (!validation.ok) {
      setUploadError(validation.message)
      showToast(validation.message, 'error')
      return
    }

    setUploadError('')
    setUploadName(file.name)
    setUploadProgress(0)
    setUploading(true)

    const result = await uploadToCloudinary(file, { onProgress: setUploadProgress })

    setUploading(false)

    if (!result.ok) {
      setUploadError(result.message)
      showToast(result.message, 'error')
      return
    }

    setField('publicUrl', result.asset.secureUrl)
    setField('mediaKind', result.asset.resourceType === 'video' ? 'video' : validation.kind)
    setUploadName('')
    setUploadProgress(100)
    showToast('Upload complete', 'success')
  }

  const handleSave = async () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.publicUrl.trim()) errs.publicUrl = 'Upload a photo or video first'

    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('Please check the highlighted fields', 'error')
      return
    }

    setSaving(true)
    const payload = {
      title: form.title,
      altText: form.caption.trim() || form.title,
      category: form.category,
      eventId: form.eventId || null,
      publicUrl: form.publicUrl,
    }

    if (editingId) {
      const result = await update(editingId, payload)
      if (!result.ok) {
        showToast(result.message || 'Could not update media', 'error')
        setSaving(false)
        return
      }
      showToast('Media updated', 'success')
    } else {
      const result = await create(payload)
      if (!result.ok) {
        showToast(result.message || 'Could not add media', 'error')
        setSaving(false)
        return
      }
      showToast('Media added', 'success')
    }
    setSaving(false)
    setModalOpen(false)
  }

  const handleDelete = async () => {
    const result = await remove(deleting.id)
    setDeleting(null)
    if (!result.ok) {
      showToast(result.message || 'Could not delete media', 'error')
      return
    }
    showToast('Media deleted', 'success')
  }

  return (
    <>
      <PageHeader
        title="Gallery"
        subtitle="Upload and manage photos and videos on the public gallery."
        actions={
          <>
            <PrimaryButton onClick={openAdd}>
              <Plus size={18} /> ADD MEDIA
            </PrimaryButton>
          </>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading gallery" />
      ) : items.length === 0 ? (
        <EmptyState title="No media yet" />
      ) : (
        <div className="admin-gallery-grid">
          {items.map((item) => (
            <div className="admin-gallery-item" key={item.id}>
              {isVideoUrl(item.publicUrl) ? (
                <>
                  <video
                    src={item.publicUrl || ''}
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={item.altText || item.title || 'Video'}
                  />
                  <span className="admin-gallery-item__play">
                    <Play size={26} fill="currentColor" />
                  </span>
                </>
              ) : (
                <img src={item.publicUrl || ''} alt={item.altText || item.title || ''} loading="lazy" />
              )}
              <div className="admin-gallery-item__overlay">
                <button className="action-btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} onClick={() => openEdit(item)} aria-label="Edit media">
                  <Edit size={17} />
                </button>
                <button className="action-btn" style={{ background: 'rgba(215,25,32,0.8)', color: '#fff' }} onClick={() => setDeleting(item)} aria-label="Delete media">
                  <Trash2 size={17} />
                </button>
              </div>
              <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, color: '#fff', fontSize: '0.78rem', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4 }}>
                {item.title || item.altText} • {item.category}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Media' : 'Add Media'}
        footer={
          <>
            <SecondaryButton onClick={() => setModalOpen(false)} disabled={saving || uploading}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving || uploading}>{saving ? 'Saving...' : 'Save Media'}</PrimaryButton>
          </>
        }
      >
        <FormInput label="Title" name="title" value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} required />
        <FormInput label="Caption (alt text)" name="caption" value={form.caption} onChange={(e) => setField('caption', e.target.value)} placeholder="Describe the media for accessibility (defaults to the title)" />
        <div className="form-grid">
          <FormSelect
            label="Category"
            name="category"
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
            options={[
              { value: 'Events', label: 'Events' },
              { value: 'Fighters', label: 'Fighters' },
              { value: 'Videos', label: 'Videos' },
              { value: 'Photos', label: 'Photos' },
            ]}
          />
          <FormSelect
            label="Linked Event (optional)"
            name="eventId"
            value={form.eventId}
            onChange={(e) => setField('eventId', e.target.value)}
            options={[
              { value: '', label: 'General gallery (no event)' },
              ...eventOptions,
            ]}
          />
        </div>

        {form.publicUrl && (
          <div className="media-upload__preview">
            {form.mediaKind === 'video' ? (
              <video src={form.publicUrl} controls playsInline />
            ) : (
              <img src={form.publicUrl} alt="Preview" />
            )}
          </div>
        )}

        <div className={`media-upload ${uploadError ? 'media-upload--error' : ''}`}>
          <label className={`media-upload__dropzone ${uploading ? 'is-uploading' : ''}`} htmlFor="gallery-media-file">
            <Upload size={26} />
            <p>
              {uploading
                ? `Uploading ${uploadName || 'file'}… ${uploadProgress}%`
                : form.publicUrl
                  ? 'Choose a different photo or video'
                  : 'Choose a photo or video to upload'}
            </p>
            <span>JPG, PNG, WebP, AVIF, GIF up to 8 MB · MP4, WebM, MOV up to 64 MB</span>
          </label>
          <input
            id="gallery-media-file"
            className="media-upload__input"
            type="file"
            accept={ACCEPTED_MEDIA}
            onChange={handleFileChange}
            disabled={uploading || saving}
          />
          {uploading && (
            <div className="media-upload__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
              <span style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          {uploadError && <p className="form-field__error">{uploadError}</p>}
          {form.publicUrl && !uploading && (
            <p className="media-upload__current">
              Current URL: <span>{form.publicUrl}</span>
            </p>
          )}
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-light-muted)', marginTop: 'var(--space-2)', lineHeight: 1.5 }}>
          Files are uploaded directly to Cloudinary via an unsigned upload preset and linked by URL. Nothing is
          uploaded to Firebase Storage.
        </p>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Media?"
        message={`This will remove "${deleting?.title}" from the gallery.`}
        confirmLabel="Delete"
      />
    </>
  )
}
