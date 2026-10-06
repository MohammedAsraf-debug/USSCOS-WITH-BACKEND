import { useState } from 'react'
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import StatusBadge from '../../components/admin/StatusBadge.jsx'
import Modal from '../../components/common/Modal.jsx'
import ConfirmModal from '../../components/common/ConfirmModal.jsx'
import FormInput, { TextArea } from '../../components/common/FormInput.jsx'
import FormSelect from '../../components/admin/FormSelect.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { useAdminStories } from '@/hooks/use-firestore'
import { useAdminMutation } from '@/hooks/use-admin-mutations'
import { useAdminWorkflow } from '@/hooks/use-admin-workflow'
import { useToast } from '../../context/ToastContext.jsx'

const emptyForm = {
  title: '',
  category: 'Announcement',
  excerpt: '',
  contentText: '',
  image: '',
  date: '',
  published: true,
}

export default function AdminNews() {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { data: stories, isLoading } = useAdminStories()
  const { create, update, remove } = useAdminMutation('stories')
  const { run } = useAdminWorkflow()

  const articles = (stories ?? []).filter((n) =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  )

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) })
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (article) => {
    setEditingId(article.id)
    setForm({
      title: article.title || '',
      category: article.tags?.[0] || 'Announcement',
      excerpt: article.excerpt || '',
      contentText: article.body || '',
      image: article.coverImageUrl || '',
      date: article.publishedAt || '',
      published: article.published ?? true,
    })
    setErrors({})
    setModalOpen(true)
  }

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSave = async () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.excerpt.trim()) errs.excerpt = 'Short description is required'
    if (!form.contentText.trim()) errs.contentText = 'Content is required'
    if (!form.image.trim()) errs.image = 'Image URL is required'

    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('Please check the highlighted fields', 'error')
      return
    }

    setSaving(true)
    const payload = {
      title: form.title,
      excerpt: form.excerpt,
      body: form.contentText,
      coverImageUrl: form.image || null,
      tags: [form.category],
      published: form.published,
      publishedAt: form.published ? new Date().toISOString() : null,
    }

    if (editingId) {
      const result = await update(editingId, payload)
      if (!result.ok) {
        showToast(result.message || 'Could not update article', 'error')
        return
      }
      showToast('Article updated', 'success')
    } else {
      const result = await create(payload)
      if (!result.ok) {
        showToast(result.message || 'Could not create article', 'error')
        return
      }
      showToast('Article created', 'success')
    }
    setSaving(false)
    setModalOpen(false)
  }

  const handleDelete = async () => {
    const result = await remove(deleting.id)
    setDeleting(null)
    if (!result.ok) {
      showToast(result.message || 'Could not delete article', 'error')
      return
    }
    showToast('Article deleted', 'success')
  }

  const togglePublish = async (article) => {
    const result = await run({ type: 'publish-story', id: article.id, published: !article.published })
    if (result.ok) {
      showToast(article.published ? 'Article unpublished' : 'Article published', 'success')
    } else {
      showToast(`Publish toggle failed: ${result.reason || 'unauthorized'}`, 'error')
    }
  }

  const visibleArticles = articles

  return (
    <>
      <PageHeader
        title="News"
        subtitle="Create, edit, and publish news articles."
        actions={
          <PrimaryButton onClick={openAdd}>
            <Plus size={18} /> ADD ARTICLE
          </PrimaryButton>
        }
      />

      <div className="table-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search articles..." />
      </div>

      {isLoading ? (
        <LoadingState label="Loading news" />
      ) : visibleArticles.length === 0 ? (
        <EmptyState title="No articles found" />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Tags</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleArticles.map((n) => (
                <tr key={n.id}>
                  <td style={{ fontWeight: 600 }}>{n.title}</td>
                  <td>{n.tags?.join(', ') || '—'}</td>
                  <td>{n.publishedAt ? new Date(n.publishedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td><StatusBadge status={n.published ? 'Published' : 'Draft'} /></td>
                  <td>
                    <div className="table-actions">
                      <button className="action-btn" onClick={() => togglePublish(n)} aria-label={n.published ? 'Unpublish' : 'Publish'}>
                        {n.published ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                      <button className="action-btn action-btn--edit" onClick={() => openEdit(n)} aria-label="Edit article">
                        <Edit size={17} />
                      </button>
                      <button className="action-btn action-btn--danger" onClick={() => setDeleting(n)} aria-label="Delete article">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Article' : 'Add Article'}
        footer={
          <>
            <SecondaryButton onClick={() => setModalOpen(false)} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Article'}</PrimaryButton>
          </>
        }
      >
        <FormInput label="Title" name="title" value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} required />
        <div className="form-grid">
          <FormSelect
            label="Category"
            name="category"
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
            options={[
              { value: 'Announcement', label: 'Announcement' },
              { value: 'Fighter Story', label: 'Fighter Story' },
              { value: 'Events', label: 'Events' },
            ]}
          />
        </div>
        <TextArea label="Short Description" name="excerpt" value={form.excerpt} onChange={(e) => setField('excerpt', e.target.value)} error={errors.excerpt} required rows={2} />
        <TextArea label="Content" name="contentText" value={form.contentText} onChange={(e) => setField('contentText', e.target.value)} error={errors.contentText} required rows={6} />
        <FormInput label="Featured Image URL" name="image" value={form.image} onChange={(e) => setField('image', e.target.value)} error={errors.image} required placeholder="https://..." />
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 600, fontSize: '0.9rem' }}>
          <input type="checkbox" checked={form.published} onChange={(e) => setField('published', e.target.checked)} />
          Published
        </label>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Article?"
        message={`This will permanently remove "${deleting?.title}".`}
        confirmLabel="Delete"
      />
    </>
  )
}