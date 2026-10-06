import { Outlet } from 'react-router-dom'
import Navbar from '../components/public/Navbar.jsx'
import Footer from '../components/public/Footer.jsx'
import FloatingActions from '../components/public/FloatingActions.jsx'

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <Navbar />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <FloatingActions />
    </div>
  )
}