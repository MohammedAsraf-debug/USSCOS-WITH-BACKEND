import { useEffect, useState } from 'react'
import { Plus, Save, Users } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import FormInput from '../../components/common/FormInput.jsx'
import Modal from '../../components/common/Modal.jsx'
import AdminList from '../../components/admin/AdminList'
import FormSelect from '../../components/admin/FormSelect'
import { useToast } from '../../context/ToastContext.jsx'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { isValidPhone, PHONE_ERROR } from '@/lib/phone'

import { createAdminUser } from '@/services/admin-users'

const emptyAdmin = {
  name: '',
  email: '',
  password: '',
  role: 'ADMIN',
}

export default function AdminSettings() {
  const { showToast } = useToast()

  // Profile state
  const profileInitial = {
    name: 'Admin User',
    email: 'admin@usscos.org',
    phone: '+91 98765 43210',
  }
  const [profile, setProfile] = useState(profileInitial)
  const [profileErrors, setProfileErrors] = useState({})

  // Website state
  const websiteInitial = {
    siteName: 'USSCOS Trust',
    tagline: 'Empowering Fighters',
    supportEmail: 'support@usscos.org',
    currency: 'INR (₹)',
  }
  const [website, setWebsite] = useState(websiteInitial)

  // Password state
  const passwordsInitial = { current: '', next: '', confirm: '' }
  const [passwords, setPasswords] = useState(passwordsInitial)
  const [passErrors, setPassErrors] = useState({})

  // --- Admin Management state ---
  const [admins, setAdmins] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('add')
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [form, setForm] = useState({ ...emptyAdmin })
  const [formErrors, setFormErrors] = useState({})
  const [savingAdmin, setSavingAdmin] = useState(false)

  // Debounced search
  const debouncedSearch = useDebouncedValue('', 300)

  // --- Profile handlers ---
  const handleSaveProfile = () => {
    const errs = {}
    if (!profile.name.trim()) errs.name = 'Name is required'
    if (!profile.email.trim()) {
      errs.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(profile.email)) {
      errs.email = 'Enter a valid email'
    }
    if (!profile.phone.trim()) {
      errs.phone = 'Phone number is required'
    } else if (!isValidPhone(profile.phone)) {
      errs.phone = PHONE_ERROR
    }
    setProfileErrors(errs)
    if (Object.keys(errs).length) {
      showToast('Please check the highlighted fields', 'error')
      return
    }
    showToast('Profile updated', 'success')
  }

  const handleSaveWebsite = () => {
    showToast('Website settings saved', 'success')
  }

  const handleChangePassword = () => {
    const errs = {}
    if (!passwords.current) errs.current = 'Current password is required'
    if (!passwords.next) errs.next = 'New password is required'
    if (passwords.next.length < 6) errs.next = 'At least 6 characters'
    if (passwords.confirm !== passwords.next) errs.confirm = 'Passwords do not match'
    if (Object.keys(errs).length) {
      setPassErrors(errs)
      showToast('Please check password fields', 'error')
      return
    }
    showToast('Password changed (demo — backend will enforce security)', 'success')
  }

  // --- Admin Management handlers ---

  const openAdminModal = (type = 'add', admin = null) => {
    setModalType(type)
    if (type === 'edit' && admin) {
      setEditingAdmin(admin.id)
      setForm({
        name: admin.name,
        email: admin.email,
        role: admin.role,
      })
    } else {
      setEditingAdmin(null)
      setForm({ ...emptyAdmin })
    }
    setModalOpen(true)
  }

  const closeAdminModal = () => {
    setModalOpen(false)
    setForm({ ...emptyAdmin })
    setFormErrors({})
    setSavingAdmin(false)
  }

  const validateForm = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email format'
    if (!form.role) errs.role = 'Role is required'
    else if (modalType === 'add' && !['ADMIN', 'CONTENT_MANAGER'].includes(form.role)) {
      errs.role = 'Role must be Admin or Content Manager'
    }
    if (modalType === 'add') {
      if (!form.password) errs.password = 'Temporary password is required'
      else if (form.password.length < 6) errs.password = 'At least 6 characters'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleAdminSave = async () => {
    if (!validateForm()) return

    if (modalType === 'add') {
      setSavingAdmin(true)
      try {
        const result = await createAdminUser({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        })
        if (!result.ok) {
          showToast(result.message, 'error')
          return
        }
        setAdmins((prev) => [
          ...prev,
          {
            id: result.user.uid,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            status: result.user.status,
            createdAt: result.user.createdAt,
          },
        ])
        showToast('Admin account created successfully.', 'success')
        closeAdminModal()
      } finally {
        setSavingAdmin(false)
      }
      return
    }

    if (editingAdmin) {
      setAdmins((prev) =>
        prev.map((a) => (a.id === editingAdmin ? { ...a, ...form } : a))
      )
      showToast('Admin updated successfully', 'success')
    }

    closeAdminModal()
  }

  const handleAdminDelete = (adminId) => {
    setAdmins((prev) => prev.filter((a) => a.id !== adminId))
    showToast('Admin removed successfully', 'success')
  }

  const confirmDelete = (adminId, adminName) => {
    // Simple confirmation - in real app would use a confirm modal
    if (window.confirm(`Are you sure you want to delete admin "${adminName}"?`)) {
      handleAdminDelete(adminId)
    }
  }

  // --- Admin Management handlers end ---

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, website settings, and security."
      />

      <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Profile Section */}
        <div className="admin-card" style={{ flex: '1 1 400px' }}>
          <h3>Admin Profile</h3>
          <FormInput label="Name" name="pname" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} error={profileErrors.name} required />
          <FormInput label="Email" name="pemail" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} error={profileErrors.email} required />
          <FormInput label="Phone" name="pphone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} error={profileErrors.phone} required />
          <PrimaryButton onClick={handleSaveProfile}>
            <Save size={18} /> SAVE PROFILE
          </PrimaryButton>
        </div>

        {/* Website Settings Section */}
        <div className="admin-card" style={{ flex: '1 1 400px' }}>
          <h3>Website Settings</h3>
          <FormInput label="Site Name" name="wname" value={website.siteName} onChange={(e) => setWebsite({ ...website, siteName: e.target.value })} />
          <FormInput label="Tagline" name="wtag" value={website.tagline} onChange={(e) => setWebsite({ ...website, tagline: e.target.value })} />
          <FormInput label="Support Email" name="wsupport" value={website.supportEmail} onChange={(e) => setWebsite({ ...website, supportEmail: e.target.value })} />
          <FormInput label="Currency" name="wcur" value={website.currency} onChange={(e) => setWebsite({ ...website, currency: e.target.value })} />
          <PrimaryButton onClick={handleSaveWebsite} full>
            <Save size={18} /> SAVE WEBSITE SETTINGS
          </PrimaryButton>
        </div>

        {/* Change Password Section */}
        <div className="admin-card" style={{ flex: '1 1 400px' }}>
          <h3>Change Password</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light-muted)', marginBottom: 'var(--space-4)' }}>
            Security is handled by the backend authentication service. This UI is a placeholder.
          </p>
          <FormInput label="Current Password" name="pcur" type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} error={passErrors.current} />
          <FormInput label="New Password" name="pnext" type="password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} error={passErrors.next} />
          <FormInput label="Confirm New Password" name="pconf" type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} error={passErrors.confirm} />
          <PrimaryButton onClick={handleChangePassword}>UPDATE PASSWORD</PrimaryButton>
        </div>

        {/* Admin Management Section - REPLACED */}
        <div className="admin-card admin-management-section" style={{ flex: '1 1 100%' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Users size={18} /> Admin Management
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-light-muted)', marginBottom: 'var(--space-4)' }}>
            Manage USSCOS Trust administrators.
          </p>

          {/* Add Admin Button */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <PrimaryButton onClick={() => openAdminModal('add')} full style={{ width: '100%' }}>
              <Plus size={18} /> ADD ADMIN
            </PrimaryButton>
          </div>

          {/* Admin Table / Cards - responsive via CSS classes */}
        <div style={{ marginTop: 'var(--space-4)' }}>
          {admins && admins.length === 0 ? (
            <p style={{ color: 'var(--text-light-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
              No admins found. Add the first administrator above.
            </p>
          ) : <AdminList admins={admins} onEdit={openAdminModal} onDelete={confirmDelete} />}</div>
        </div>
      </div>

      {/* Admin Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeAdminModal}
        title={editingAdmin ? `Edit Admin — ${form.name}` : 'Add Admin'}
        dark
      >
        <FormInput
          label="Name"
          name="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={formErrors.name}
          required
        />
        <FormInput
          label="Email"
          name="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={formErrors.email}
          type="email"
          required
        />
        <FormSelect
          label="Role"
          name="role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          options={[
            { value: 'ADMIN', label: 'Admin' },
            { value: 'CONTENT_MANAGER', label: 'Content Manager' },
          ]}
        />
        {modalType === 'add' && (
          <FormInput
            label="Temporary Password"
            name="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={formErrors.password}
            required
          />
        )}

        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <SecondaryButton onClick={closeAdminModal} disabled={savingAdmin}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleAdminSave} disabled={savingAdmin}>
            {savingAdmin ? 'Creating...' : modalType === 'add' ? 'Add Admin' : 'Save Changes'}
          </PrimaryButton>
        </div>
      </Modal>
    </>
  )
}