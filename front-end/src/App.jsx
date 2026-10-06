import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext.jsx'
import { ScrollToTop } from './utils/ScrollToTop.jsx'
import { PageTransition } from './utils/PageTransition.jsx'

import PublicLayout from './layouts/PublicLayout.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'

const Home = lazy(() => import('./pages/public/Home.jsx'))
const About = lazy(() => import('./pages/public/About.jsx'))
const Athletes = lazy(() => import('./pages/public/Athletes.jsx'))
const AthleteProfile = lazy(() => import('./pages/public/AthleteProfile.jsx'))
const SeekingSponsorship = lazy(() => import('./pages/public/SeekingSponsorship.jsx'))
const Apply = lazy(() => import('./pages/public/Apply.jsx'))
const AcademyApplication = lazy(() => import('./pages/public/AcademyApplication.jsx'))
const SponsorshipsHub = lazy(() => import('./pages/public/SponsorshipsHub.jsx'))
const SponsorshipOpportunities = lazy(() => import('./pages/public/SponsorshipOpportunities.jsx'))
const SponsorshipsImpact = lazy(() => import('./pages/public/Sponsorships.jsx'))
const AthleteSponsorship = lazy(() => import('./pages/public/AthleteSponsorship.jsx'))
const AcademyDetails = lazy(() => import('./pages/public/AcademyDetails.jsx'))
const SponsorRequest = lazy(() => import('./pages/public/SponsorRequest.jsx'))
const News = lazy(() => import('./pages/public/News.jsx'))
const NewsDetail = lazy(() => import('./pages/public/NewsDetail.jsx'))
const EventsPage = lazy(() => import('./pages/public/EventsPage.jsx'))
const EventDetail = lazy(() => import('./pages/public/EventDetail.jsx'))
const Gallery = lazy(() => import('./pages/public/Gallery.jsx'))
const Donate = lazy(() => import('./pages/public/Donate.jsx'))
const PaymentSuccess = lazy(() => import('./pages/public/PaymentSuccess.jsx'))
const Contact = lazy(() => import('./pages/public/Contact.jsx'))
const Faq = lazy(() => import('./pages/public/Faq.jsx'))
const Terms = lazy(() => import('./pages/public/Terms.jsx'))
const Privacy = lazy(() => import('./pages/public/Privacy.jsx'))
const RefundCancellation = lazy(() => import('./pages/public/RefundCancellation.jsx'))
const NotFound = lazy(() => import('./pages/public/NotFound.jsx'))

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.jsx'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'))
const AdminAthletes = lazy(() => import('./pages/admin/AdminAthletes.jsx'))
const AdminGroups = lazy(() => import('./pages/admin/AdminGroups.jsx'))
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents.jsx'))
const AdminApplications = lazy(() => import('./pages/admin/AdminApplications.jsx'))
const AdminSponsorships = lazy(() => import('./pages/admin/AdminSponsorships.jsx'))
const AdminPartners = lazy(() => import('./pages/admin/AdminPartners.jsx'))
const AdminEnquiries = lazy(() => import('./pages/admin/AdminEnquiries.jsx'))
const AdminNews = lazy(() => import('./pages/admin/AdminNews.jsx'))
const AdminGallery = lazy(() => import('./pages/admin/AdminGallery.jsx'))
const AdminDocuments = lazy(() => import('./pages/admin/AdminDocuments.jsx'))
const AdminContent = lazy(() => import('./pages/admin/AdminContent.jsx'))
const AdminContentPage = lazy(() => import('./pages/admin/AdminContentPage.jsx'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings.jsx'))

const PageLoader = () => (
  <div className="page-loader" role="status" aria-label="Loading">
    <span></span>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ScrollToTop />
        <PageTransition>
          <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes/:id" element={<AthleteProfile />} />
            <Route path="/seeking-sponsorship" element={<SeekingSponsorship />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/apply/academy" element={<AcademyApplication />} />
            <Route path="/sponsorships" element={<SponsorshipsHub />} />
            <Route path="/sponsorships/opportunities" element={<SponsorshipOpportunities />} />
            <Route path="/sponsorships/provided" element={<SponsorshipsImpact />} />
            <Route path="/sponsorships/athlete/:id" element={<AthleteSponsorship />} />
            <Route path="/sponsorships/academy/:academyId" element={<AcademyDetails />} />
            <Route path="/sponsorships/sponsor" element={<SponsorRequest />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:id" element={<NewsDetail />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:eventId" element={<EventDetail />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/donate" element={<Donate />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refund-cancellation" element={<RefundCancellation />} />
          </Route>

          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="athletes" element={<AdminAthletes />} />
            <Route path="groups" element={<AdminGroups />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="sponsorships" element={<AdminSponsorships />} />
            <Route path="partners" element={<AdminPartners />} />
            <Route path="enquiries" element={<AdminEnquiries />} />
            <Route path="news" element={<AdminNews />} />
            <Route path="gallery" element={<AdminGallery />} />
            <Route path="documents" element={<AdminDocuments />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="content/:pageId" element={<AdminContentPage />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
          </Suspense>
        </PageTransition>
      </ToastProvider>
    </BrowserRouter>
  )
}