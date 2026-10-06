import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import AdminSidebar from '../components/admin/AdminSidebar.jsx'
import AdminHeader from '../components/admin/AdminHeader.jsx'
import { useAuthSession } from '@/components/admin/admin-guard'

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { status, session } = useAuthSession()

  if (status === 'loading') {
    return (
      <div className="page-loader" role="status" aria-label="Loading">
        <span></span>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="admin-layout">
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={() => setSidebarOpen(false)}
      />
      <div className="admin-main">
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          adminName={session?.email ?? 'Admin'}
          adminEmail={session?.email ?? ''}
        />
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
