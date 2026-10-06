import { useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import FilterBar from '../../components/common/FilterBar.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import Modal from '../../components/common/Modal.jsx'
import ConfirmModal from '../../components/common/ConfirmModal.jsx'
import FormInput, { TextArea } from '../../components/common/FormInput.jsx'
import FormSelect from '../../components/admin/FormSelect.jsx'
import StatusBadge from '../../components/admin/StatusBadge.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { useAdminEvents } from '@/hooks/use-firestore'
import { useAdminMutation } from '@/hooks/use-admin-mutations'
import { useToast } from '../../context/ToastContext.jsx'

const today = new Date().toISOString().split('T')[0]

const emptyForm = {
  title: '',
  type: 'informational',
  status: 'upcoming',
  date: today,
  time: '',
  endTime: '',
  location: '',
  description: '',
  image: '',
  registrationUrl: '',
  registrationNote: '',
}

export default function AdminEvents() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { data: events, isLoading } = useAdminEvents()
  const { create, update, remove, isAdmin } = useAdminMutation('events')

  const eventsList = events ?? []

  const filteredEvents = eventsList.filter((ev) => {
    const matchesSearch = !search || ev.title?.toLowerCase().includes(search.toLowerCase()) || ev.location?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = status === 'all' || ev.status === status
    return matchesSearch && matchesStatus
  })

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (ev) => {
    setEditingId(ev.id)
    setForm({
      title: ev.title || '',
      type: ev.type || 'informational',
      status: ev.status || 'upcoming',
      date: ev.date ? ev.date.slice(0, 10) : today,
      time: ev.time || '',
      endTime: ev.endTime || '',
      location: ev.location || '',
      description: ev.description || '',
      image: ev.coverImageUrl || '',
      registrationUrl: ev.registrationUrl || '',
      registrationNote: ev.registrationNote || '',
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
    if (!form.date.trim()) errs.date = 'Date is required'
    if (!form.image.trim()) errs.image = 'Image URL is required'

    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('Please check the highlighted fields', 'error')
      return
    }

    const payload = {
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      date: form.date.trim(),
      time: form.time.trim() || undefined,
      endTime: form.endTime.trim() || undefined,
      location: form.location.trim() || undefined,
      description: form.description.trim() || undefined,
      coverImageUrl: form.image.trim() || '',
      registrationUrl: form.registrationUrl.trim() || '',
      registrationNote: form.registrationNote.trim() || undefined,
    }

    setSaving(true)
    const result = editingId ? await update(editingId, payload) : await create(payload)
    setSaving(false)
    if (result.ok) {
      showToast(editingId ? 'Event updated' : 'Event added', 'success')
      setModalOpen(false)
    } else {
      showToast(result.message || 'Could not save event', 'error')
    }
  }

  const handleDelete = async () => {
    const result = await remove(deleting.id)
    setDeleting(null)
    if (result.ok) {
      showToast('Event deleted', 'success')
    } else {
      showToast(result.message || 'Could not delete event', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Manage the events listed on the public site."
        actions={
          <PrimaryButton onClick={openAdd}>
            <Plus size={18} /> ADD EVENT
          </PrimaryButton>
        }
      />

      <div className="table-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search events..." />
        <FilterBar
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: status,
              options: [
                { value: 'all', label: 'All Statuses' },
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'past', label: 'Past' },
                { value: 'draft', label: 'Draft' },
              ],
            },
          ]}
          onFilterChange={(key, value) => setStatus(value)}
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading events" />
      ) : filteredEvents.length === 0 ? (
        <EmptyState title="No events found" />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Type</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 600 }}>{ev.title}</td>
                  <td>{ev.type?.replace(/_/g, ' ')}</td>
                  <td><StatusBadge status={ev.status} /></td>
                  <td>{ev.date ? new Date(ev.date).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="action-btn action-btn--edit" onClick={() => openEdit(ev)} aria-label="Edit event">
                        <Edit size={17} />
                      </button>
                      {isAdmin && (
                        <button className="action-btn action-btn--danger" onClick={() => setDeleting(ev)} aria-label="Delete event">
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
        title={editingId ? 'Edit Event' : 'Add Event'}
        footer={
          <>
            <SecondaryButton onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Event'}
            </PrimaryButton>
          </>
        }
      >
        <FormInput label="Event Title" name="title" value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} required />
        <div className="form-grid">
          <FormSelect
            label="Type"
            name="type"
            value={form.type}
            onChange={(e) => setField('type', e.target.value)}
            options={[
              { value: 'informational', label: 'Informational' },
              { value: 'athlete_or_group_involving', label: 'Fighter / Group' },
              { value: 'sponsorship_opportunity', label: 'Sponsorship Opportunity' },
            ]}
          />
          <FormSelect
            label="Status"
            name="status"
            value={form.status}
            onChange={(e) => setField('status', e.target.value)}
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'past', label: 'Past' },
              { value: 'draft', label: 'Draft' },
            ]}
          />
        </div>
        <div className="form-grid">
          <FormInput label="Date" name="date" type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} error={errors.date} required />
          <FormInput label="Start Time" name="time" value={form.time} onChange={(e) => setField('time', e.target.value)} placeholder="e.g. 10:00 AM" />
        </div>
        <div className="form-grid">
          <FormInput label="End Time" name="endTime" value={form.endTime} onChange={(e) => setField('endTime', e.target.value)} placeholder="e.g. 01:00 PM" />
          <FormInput label="Location" name="location" value={form.location} onChange={(e) => setField('location', e.target.value)} />
        </div>
        <FormInput label="Image URL" name="image" value={form.image} onChange={(e) => setField('image', e.target.value)} error={errors.image} required placeholder="https://..." />
        <div className="form-grid">
          <FormInput label="Registration URL" name="registrationUrl" value={form.registrationUrl} onChange={(e) => setField('registrationUrl', e.target.value)} placeholder="https://..." />
          <FormInput label="Registration Note" name="registrationNote" value={form.registrationNote} onChange={(e) => setField('registrationNote', e.target.value)} />
        </div>
        <TextArea label="Description" name="description" value={form.description} onChange={(e) => setField('description', e.target.value)} rows={3} />
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Event?"
        message={`This will permanently remove "${deleting?.title || 'this event'}".`}
        confirmLabel="Delete"
      />
    </>
  )
}