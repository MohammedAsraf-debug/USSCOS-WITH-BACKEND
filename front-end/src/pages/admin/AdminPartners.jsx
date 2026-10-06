import { useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import FilterBar from '../../components/common/FilterBar.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import Modal from '../../components/common/Modal.jsx'
import ConfirmModal from '../../components/common/ConfirmModal.jsx'
import FormInput from '../../components/common/FormInput.jsx'
import FormSelect from '../../components/admin/FormSelect.jsx'
import StatusBadge from '../../components/admin/StatusBadge.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { useAdminPartners } from '@/hooks/use-firestore'
import { useAdminMutation } from '@/hooks/use-admin-mutations'
import { useToast } from '../../context/ToastContext.jsx'

const emptyForm = {
  name: '',
  type: 'sponsor',
  category: '',
  image: '',
  website: '',
}

export default function AdminPartners() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { data: partners, isLoading } = useAdminPartners()
  const { create, update, remove, isAdmin } = useAdminMutation('partners')

  const partnersList = partners ?? []

  const filteredPartners = partnersList.filter((p) => {
    const matchesSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())
    const matchesType = type === 'all' || p.type === type
    return matchesSearch && matchesType
  })

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (partner) => {
    setEditingId(partner.id)
    setForm({
      name: partner.name || '',
      type: partner.type || 'sponsor',
      category: partner.category || '',
      image: partner.logoUrl || '',
      website: partner.website || '',
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
    if (!form.name.trim()) errs.name = 'Partner name is required'
    if (!form.image.trim()) errs.image = 'Logo URL is required'

    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('Please check the highlighted fields', 'error')
      return
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      category: form.category.trim() || undefined,
      logoUrl: form.image.trim() || '',
      website: form.website.trim() || '',
    }

    setSaving(true)
    const result = editingId ? await update(editingId, payload) : await create(payload)
    setSaving(false)
    if (result.ok) {
      showToast(editingId ? 'Partner updated' : 'Partner added', 'success')
      setModalOpen(false)
    } else {
      showToast(result.message || 'Could not save partner', 'error')
    }
  }

  const handleDelete = async () => {
    const result = await remove(deleting.id)
    setDeleting(null)
    if (result.ok) {
      showToast('Partner deleted', 'success')
    } else {
      showToast(result.message || 'Could not delete partner', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Partners"
        subtitle="Manage sponsors and supporting organisations."
        actions={
          <PrimaryButton onClick={openAdd}>
            <Plus size={18} /> ADD PARTNER
          </PrimaryButton>
        }
      />

      <div className="table-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search partners..." />
        <FilterBar
          filters={[
            {
              key: 'type',
              label: 'Type',
              value: type,
              options: [
                { value: 'all', label: 'All Types' },
                { value: 'sponsor', label: 'Sponsor' },
                { value: 'academy-group', label: 'Academy / Group' },
                { value: 'media', label: 'Media' },
              ],
            },
          ]}
          onFilterChange={(key, value) => setType(value)}
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading partners" />
      ) : filteredPartners.length === 0 ? (
        <EmptyState title="No partners found" />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Type</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="data-table__avatar">
                      <img src={p.logoUrl || ''} alt="" /> <span>{p.name}</span>
                    </span>
                  </td>
                  <td>{p.type}</td>
                  <td>{p.category || '—'}</td>
                  <td><StatusBadge status={p.active ? 'Active' : 'Inactive'} /></td>
                  <td>
                    <div className="table-actions">
                      <button className="action-btn action-btn--edit" onClick={() => openEdit(p)} aria-label="Edit partner">
                        <Edit size={17} />
                      </button>
                      {isAdmin && (
                        <button className="action-btn action-btn--danger" onClick={() => setDeleting(p)} aria-label="Delete partner">
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Partner' : 'Add Partner'}
        footer={
          <>
            <SecondaryButton onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Partner'}
            </PrimaryButton>
          </>
        }
      >
        <FormInput label="Partner Name" name="name" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required />
        <div className="form-grid">
          <FormSelect
            label="Type"
            name="type"
            value={form.type}
            onChange={(e) => setField('type', e.target.value)}
            options={[
              { value: 'sponsor', label: 'Sponsor' },
              { value: 'academy-group', label: 'Academy / Group' },
              { value: 'media', label: 'Media' },
            ]}
          />
          <FormInput label="Category" name="category" value={form.category} onChange={(e) => setField('category', e.target.value)} placeholder="e.g. Title Sponsor" />
        </div>
        <FormInput label="Logo URL" name="image" value={form.image} onChange={(e) => setField('image', e.target.value)} error={errors.image} required placeholder="https://..." />
        <FormInput label="Website" name="website" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://..." />
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Partner?"
        message={`This will permanently remove "${deleting?.name || 'this partner'}".`}
        confirmLabel="Delete"
      />
    </>
  )
}