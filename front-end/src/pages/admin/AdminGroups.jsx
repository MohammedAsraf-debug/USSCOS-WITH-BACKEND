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
import FormSelect from '../../components/admin/FormSelect.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { useAdminGroups } from '@/hooks/use-firestore'
import { useAdminMutation } from '@/hooks/use-admin-mutations'
import { useAdminWorkflow } from '@/hooks/use-admin-workflow'
import { useToast } from '../../context/ToastContext.jsx'

const emptyForm = {
  name: '',
  groupType: 'club',
  location: '',
  members: '',
  sports: '',
  description: '',
  website: '',
  image: '',
}

export default function AdminGroups() {
  const [search, setSearch] = useState('')
  const [groupType, setGroupType] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [approving, setApproving] = useState(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { data: groups, isLoading } = useAdminGroups()
  const { create, update, remove, isAdmin } = useAdminMutation('groups')
  const { run: runWorkflow, isAdmin: canApprove, isPending: workflowPending } = useAdminWorkflow()

  const groupsList = groups ?? []

  const filteredGroups = groupsList.filter((g) => {
    const matchesSearch = !search || g.groupName?.toLowerCase().includes(search.toLowerCase()) || g.location?.toLowerCase().includes(search.toLowerCase())
    const matchesType = groupType === 'all' || g.groupType === groupType
    return matchesSearch && matchesType
  })

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (group) => {
    setEditingId(group.id)
    setForm({
      name: group.groupName || '',
      groupType: group.groupType || 'club',
      location: group.location || '',
      members: group.memberCount != null ? String(group.memberCount) : '',
      sports: Array.isArray(group.sports) ? group.sports.join(', ') : '',
      description: group.description || '',
      website: group.website || '',
      image: group.profileImageUrl || '',
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
    if (!form.name.trim()) errs.name = 'Group name is required'
    if (!form.image.trim()) errs.image = 'Image URL is required'

    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('Please check the highlighted fields', 'error')
      return
    }

    const members = Number(form.members)
    const payload = {
      groupName: form.name.trim(),
      groupType: form.groupType,
      location: form.location.trim() || undefined,
      memberCount: form.members.trim() && Number.isInteger(members) && members >= 0 ? members : undefined,
      sports: form.sports ? form.sports.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      description: form.description.trim() || undefined,
      website: form.website.trim() || '',
      profileImageUrl: form.image.trim() || '',
    }

    setSaving(true)
    const result = editingId ? await update(editingId, payload) : await create(payload)
    setSaving(false)
    if (result.ok) {
      showToast(editingId ? 'Group updated' : 'Group added', 'success')
      setModalOpen(false)
    } else {
      showToast(result.message || 'Could not save group', 'error')
    }
  }

  const handleDelete = async () => {
    const result = await remove(deleting.id)
    setDeleting(null)
    if (result.ok) {
      showToast('Group deleted', 'success')
    } else {
      showToast(result.message || 'Could not delete group', 'error')
    }
  }

  const handleApprove = async () => {
    const result = await runWorkflow({
      type: 'approve-entity',
      kind: 'groups',
      id: approving.id,
      to: 'approved',
    })
    setApproving(null)
    if (result.ok) {
      showToast('Group approved and published', 'success')
    } else {
      showToast(result.message || `Approval failed: ${result.reason || 'unauthorized'}`, 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle="Manage clubs, academies and associations in the directory."
        actions={
          <PrimaryButton onClick={openAdd}>
            <Plus size={18} /> ADD GROUP
          </PrimaryButton>
        }
      />

      <div className="table-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search groups..." />
        <FilterBar
          filters={[
            {
              key: 'groupType',
              label: 'Type',
              value: groupType,
              options: [
                { value: 'all', label: 'All Types' },
                { value: 'team', label: 'Team' },
                { value: 'club', label: 'Club' },
                { value: 'academy', label: 'Academy' },
                { value: 'association', label: 'Association' },
              ],
            },
          ]}
          onFilterChange={(key, value) => setGroupType(value)}
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading groups" />
      ) : filteredGroups.length === 0 ? (
        <EmptyState title="No groups found" />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Type</th>
                <th>Location</th>
                <th>Members</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((g) => (
                <tr key={g.id}>
                  <td>
                    <span className="data-table__avatar">
                      <img src={g.profileImageUrl || ''} alt="" /> <span>{g.groupName}</span>
                    </span>
                  </td>
                  <td>{g.groupType}</td>
                  <td>{g.location || '—'}</td>
                  <td>{g.memberCount != null ? g.memberCount : '—'}</td>
                  <td>
                    <StatusBadge status={g.approvalStatus} />
                  </td>
                  <td>
                    <div className="table-actions">
                      {canApprove && g.approvalStatus !== 'approved' && (
                        <button
                          className="action-btn action-btn--approve"
                          onClick={() => setApproving(g)}
                          disabled={workflowPending}
                          aria-label="Approve group"
                          title="Approve and publish"
                        >
                          <Check size={17} />
                        </button>
                      )}
                      <button className="action-btn action-btn--edit" onClick={() => openEdit(g)} aria-label="Edit group">
                        <Edit size={17} />
                      </button>
                      {isAdmin && (
                        <button className="action-btn action-btn--danger" onClick={() => setDeleting(g)} aria-label="Delete group">
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
        title={editingId ? 'Edit Group' : 'Add Group'}
        footer={
          <>
            <SecondaryButton onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Group'}
            </PrimaryButton>
          </>
        }
      >
        <FormInput label="Group Name" name="name" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required />
        <div className="form-grid">
          <FormSelect
            label="Group Type"
            name="groupType"
            value={form.groupType}
            onChange={(e) => setField('groupType', e.target.value)}
            options={[
              { value: 'team', label: 'Team' },
              { value: 'club', label: 'Club' },
              { value: 'academy', label: 'Academy' },
              { value: 'association', label: 'Association' },
            ]}
          />
          <FormInput label="Location" name="location" value={form.location} onChange={(e) => setField('location', e.target.value)} />
        </div>
        <div className="form-grid">
          <FormInput label="Member Count" name="members" type="number" value={form.members} onChange={(e) => setField('members', e.target.value)} placeholder="e.g. 45" />
          <FormInput label="Sports" name="sports" value={form.sports} onChange={(e) => setField('sports', e.target.value)} placeholder="e.g. Boxing, Wrestling" />
        </div>
        <FormInput label="Image URL" name="image" value={form.image} onChange={(e) => setField('image', e.target.value)} error={errors.image} required placeholder="https://..." />
        <FormInput label="Website" name="website" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://..." />
        <TextArea label="Description" name="description" value={form.description} onChange={(e) => setField('description', e.target.value)} rows={3} />
      </Modal>

      {/* Approve/Publish confirm */}
      <ConfirmModal
        open={!!approving}
        onClose={() => setApproving(null)}
        onConfirm={handleApprove}
        title="Approve Group?"
        message={`This will publish ${approving?.groupName || 'this group'} to the public groups directory.`}
        confirmLabel="Approve & Publish"
        loading={workflowPending}
      />

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Group?"
        message={`This will permanently remove ${deleting?.groupName || 'this group'} from the directory.`}
        confirmLabel="Delete"
      />
    </>
  )
}