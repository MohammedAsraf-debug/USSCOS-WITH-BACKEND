import { useState } from 'react'
import { Plus, Edit, Trash2, Check } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import StatusBadge from '../../components/admin/StatusBadge.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import FilterBar from '../../components/common/FilterBar.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import Modal from '../../components/common/Modal.jsx'
import ConfirmModal from '../../components/common/ConfirmModal.jsx'
import FormInput, { TextArea } from '../../components/common/FormInput.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { useAdminAthletes } from '@/hooks/use-firestore'
import { useAdminMutation } from '@/hooks/use-admin-mutations'
import { useAdminWorkflow } from '@/hooks/use-admin-workflow'
import { useToast } from '../../context/ToastContext.jsx'

const emptyForm = {
  name: '',
  sport: '',
  category: '',
  location: '',
  age: '',
  bio: '',
  coach: '',
  academy: '',
  ranking: '',
  image: '',
}

export default function AdminAthletes() {
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [approving, setApproving] = useState(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { data: athletes, isLoading } = useAdminAthletes()
  const { create, update, remove } = useAdminMutation('athletes')
  const { run: runWorkflow, isAdmin: canApprove, isPending: workflowPending } = useAdminWorkflow()

  const athletesList = athletes ?? []

  const filteredAthletes = athletesList.filter((a) => {
    const matchesSearch = !search || a.fullName?.toLowerCase().includes(search.toLowerCase()) || a.sport?.toLowerCase().includes(search.toLowerCase())
    const matchesSport = sport === 'all' || a.sport === sport
    return matchesSearch && matchesSport
  })

  const sports = [...new Set(athletesList.map((a) => a.sport).filter(Boolean))]

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (athlete) => {
    setEditingId(athlete.id)
    setForm({
      name: athlete.fullName || '',
      sport: athlete.sport || '',
      category: athlete.level || '',
      location: '',
      age: '',
      bio: athlete.biography || '',
      coach: '',
      academy: '',
      ranking: athlete.record || '',
      image: athlete.profileImageUrl || '',
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
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.sport.trim()) errs.sport = 'Sport is required'
    if (!form.image.trim()) errs.image = 'Image URL is required'

    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('Please check the highlighted fields', 'error')
      return
    }

    setSaving(true)
    const payload = {
      fullName: form.name,
      sport: form.sport,
      level: form.category || form.ranking || null,
      biography: form.bio || null,
      profileImageUrl: form.image || null,
    }
    let result
    if (editingId) {
      result = await update(editingId, payload)
    } else {
      result = await create(payload)
    }
    setSaving(false)
    if (!result.ok) {
      showToast(result.message || 'Could not save fighter', 'error')
      return
    }
    showToast(editingId ? 'Fighter updated' : 'Fighter added', 'success')
    setModalOpen(false)
  }

  const handleDelete = async () => {
    const result = await remove(deleting.id)
    setDeleting(null)
    if (!result.ok) {
      showToast(result.message || 'Could not delete fighter', 'error')
      return
    }
    showToast('Fighter deleted', 'success')
  }

  const handleApprove = async () => {
    const result = await runWorkflow({
      type: 'approve-entity',
      kind: 'athletes',
      id: approving.id,
      to: 'approved',
    })
    setApproving(null)
    if (result.ok) {
      showToast('Fighter approved and published', 'success')
    } else {
      showToast(result.message || `Approval failed: ${result.reason || 'unauthorized'}`, 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Fighters"
        subtitle="Manage the fighters in the USSCOS directory."
        actions={
          <PrimaryButton onClick={openAdd}>
            <Plus size={18} /> ADD FIGHTER
          </PrimaryButton>
        }
      />

      <div className="table-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search fighters..." />
        <FilterBar
          filters={[
            {
              key: 'sport',
              label: 'Sport',
              value: sport,
              options: [
                { value: 'all', label: 'All Sports' },
                ...sports.map((s) => ({ value: s, label: s })),
              ],
            },
          ]}
          onFilterChange={(key, value) => setSport(value)}
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading fighters" />
      ) : filteredAthletes.length === 0 ? (
        <EmptyState title="No fighters found" />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fighter</th>
                <th>Sport</th>
                <th>Level</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAthletes.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="data-table__avatar">
                      <img src={a.profileImageUrl || ''} alt="" /> <span>{a.fullName}</span>
                    </span>
                  </td>
                  <td>{a.sport}</td>
                  <td>{a.level || a.record || '—'}</td>
                  <td>
                    <StatusBadge status={a.approvalStatus} />
                  </td>
                  <td>
                    <div className="table-actions">
                      {canApprove && a.approvalStatus !== 'approved' && (
                        <button
                          className="action-btn action-btn--approve"
                          onClick={() => setApproving(a)}
                          disabled={workflowPending}
                          aria-label="Approve fighter"
                          title="Approve and publish"
                        >
                          <Check size={17} />
                        </button>
                      )}
                      <button className="action-btn action-btn--edit" onClick={() => openEdit(a)} aria-label="Edit fighter">
                        <Edit size={17} />
                      </button>
                      <button className="action-btn action-btn--danger" onClick={() => setDeleting(a)} aria-label="Delete fighter">
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

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Fighter' : 'Add Fighter'} 
        footer={
          <>
            <SecondaryButton onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Fighter'}
            </PrimaryButton>
          </>
        }
      >
        <FormInput label="Fighter Name" name="name" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required />
        <div className="form-grid">
          <FormInput label="Sport" name="sport" value={form.sport} onChange={(e) => setField('sport', e.target.value)} error={errors.sport} required />
          <FormInput label="Category" name="category" value={form.category} onChange={(e) => setField('category', e.target.value)} placeholder="e.g. Combat Sports" />
          <FormInput label="Location" name="location" value={form.location} onChange={(e) => setField('location', e.target.value)} />
          <FormInput label="Age" name="age" type="number" value={form.age} onChange={(e) => setField('age', e.target.value)} />
        </div>
        <FormInput label="Photo URL" name="image" value={form.image} onChange={(e) => setField('image', e.target.value)} error={errors.image} required placeholder="https://..." />
        <FormInput label="Coach" name="coach" value={form.coach} onChange={(e) => setField('coach', e.target.value)} />
        <div className="form-grid">
          <FormInput label="Academy" name="academy" value={form.academy} onChange={(e) => setField('academy', e.target.value)} />
          <FormInput label="Ranking" name="ranking" value={form.ranking} onChange={(e) => setField('ranking', e.target.value)} />
        </div>
        <TextArea label="Biography" name="bio" value={form.bio} onChange={(e) => setField('bio', e.target.value)} rows={3} />
      </Modal>

      {/* Approve/Publish confirm */}
      <ConfirmModal
        open={!!approving}
        onClose={() => setApproving(null)}
        onConfirm={handleApprove}
        title="Approve Fighter?"
        message={`This will publish ${approving?.fullName || 'this fighter'} to the public fighters directory.`}
        confirmLabel="Approve & Publish"
        loading={workflowPending}
      />

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Fighter?"
        message={`This will permanently remove ${deleting?.fullName || 'this fighter'} from the directory.`}
        confirmLabel="Delete"
      />
    </>
  )
}