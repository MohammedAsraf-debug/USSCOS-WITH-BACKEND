import { useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Check,
} from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import DocumentCollection from '../../components/public/DocumentCollection.jsx'
import { buildSponsorshipRequestDoc, createFormNonce } from '@/services/firestore-adapter'
import { submitPublicApplication } from '@/services/public-application-submission'
import {
  FIGHTER_DOCUMENT_CATEGORIES,
  validateDocumentFile,
  validateDocuments,
  createDocumentId,
} from '@/lib/documents'
import { uploadPrivateDocument } from '@/services/private-documents'
import { isValidPhone, PHONE_ERROR } from '@/lib/phone'
import { useToast } from '../../context/ToastContext.jsx'

const STEPS = [
  'Personal',
  'Sport',
  'Achievements',
  'Funding',
  'Documents',
  'Social',
]

const initialForm = {
  athleteName: '',
  dateOfBirth: '',
  location: '',
  phone: '',
  email: '',
  sport: '',
  coach: '',
  academy: '',
  currentRanking: '',
  majorAchievements: '',
  upcomingCompetitions: '',
  amountRequested: '',
  purposeOfFunding: '',
  documents: [],
  documentTypes: {},
  socialMedia: { instagram: '', facebook: '', linkedin: '', other: '' },
  consentGiven: false,
}

const validateStep = (step, form) => {
  const errors = {}
  if (step === 0) {
    if (!form.athleteName.trim()) errors.athleteName = 'Full name is required'
    if (!form.dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
    if (!form.location.trim()) errors.location = 'Location is required'
    if (!form.phone.trim()) {
      errors.phone = 'Phone number is required'
    } else if (!isValidPhone(form.phone)) {
      errors.phone = PHONE_ERROR
    }
    if (!form.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Enter a valid email address'
    }
  }
  if (step === 1) {
    if (!form.sport.trim()) errors.sport = 'Sport / discipline is required'
  }
  if (step === 2) {
    if (!form.majorAchievements.trim()) errors.majorAchievements = 'List your major achievements'
  }
  if (step === 3) {
    if (!form.amountRequested) errors.amountRequested = 'Sponsorship amount is required'
    else if (Number(form.amountRequested) <= 0) errors.amountRequested = 'Enter a valid amount'
    if (!form.purposeOfFunding.trim()) errors.purposeOfFunding = 'Purpose of funding is required'
  }
  return errors
}

function Field({ label, name, value, onChange, error, type = 'text', required = false, placeholder }) {
  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label} {required && <span className="form-field__required">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className={`form-input ${error ? 'form-input--error' : ''}`}
      />
      {error && <span className="form-field__error">{error}</span>}
    </div>
  )
}

function TextArea({ label, name, value, onChange, error, required = false, placeholder }) {
  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label} {required && <span className="form-field__required">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className={`form-input ${error ? 'form-input--error' : ''}`}
      />
      {error && <span className="form-field__error">{error}</span>}
    </div>
  )
}

export default function Apply() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [docErrors, setDocErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [referenceId, setReferenceId] = useState('')
  // Server-created application + one-time upload capabilities. Kept so a
  // failed document upload can be retried without creating a second record.
  const [submission, setSubmission] = useState(null)
  // Failed document uploads (never a success claim while required docs fail).
  const [uploadError, setUploadError] = useState(null)
  const documentFiles = useRef(new Map())
  const { showToast } = useToast()

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const setDocumentType = (categoryId, value) => {
    setForm((prev) => ({ ...prev, documentTypes: { ...prev.documentTypes, [categoryId]: value } }))
    setDocErrors((prev) => ({ ...prev, [categoryId]: undefined }))
  }

  const handleAttachFile = async (categoryId, file) => {
    const validation = validateDocumentFile(file)
    if (!validation.ok) {
      setDocErrors((prev) => ({ ...prev, [categoryId]: validation.message }))
      return
    }
    // Bytes remain in memory until the application record exists. The server
    // then issues a document-scoped, one-time upload capability.
    const category = FIGHTER_DOCUMENT_CATEGORIES.find((c) => c.id === categoryId)
    const entry = {
      id: createDocumentId(),
      documentCategory: categoryId,
      documentType: form.documentTypes[categoryId] || undefined,
      fileName: file.name,
      fileSizeBytes: file.size,
      fileType: file.type || 'application/octet-stream',
      storageRef: null,
      fileUrl: null,
      status: 'recorded',
      uploadedAt: null,
      verificationStatus: 'not-verified',
    }
    documentFiles.current.set(entry.id, file)
    setForm((prev) => {
      const rest =
        category && !category.multiple
          ? prev.documents.filter((d) => d.documentCategory !== categoryId)
          : prev.documents
      return { ...prev, documents: [...rest, entry] }
    })
    setDocErrors((prev) => ({ ...prev, [categoryId]: undefined }))
  }

  const handleRemoveDocument = (categoryId, entryId) => {
    documentFiles.current.delete(entryId)
    setForm((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== entryId),
    }))
    setDocErrors((prev) => ({ ...prev, [categoryId]: undefined }))
  }

  const setSocial = (name, value) => {
    setForm((prev) => ({
      ...prev,
      socialMedia: { ...prev.socialMedia, [name]: value },
    }))
  }

  const handleNext = () => {
    const stepErrors = validateStep(step, form)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      showToast('Please fix the highlighted fields', 'error')
      return
    }
    setErrors({})
    if (step === 4) {
      const docIssues = validateDocuments(
        FIGHTER_DOCUMENT_CATEGORIES,
        form.documents,
        form.documentTypes,
      )
      if (Object.keys(docIssues).length > 0) {
        setDocErrors(docIssues)
        showToast('Please attach the required documents', 'error')
        return
      }
      setDocErrors({})
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isRequiredDocCategory = (categoryId) =>
    FIGHTER_DOCUMENT_CATEGORIES.find((c) => c.id === categoryId)?.required ?? false

  // Upload entries through the backend with the one-time capabilities issued
  // for this application. Capabilities stay valid after a FAILED attempt
  // (the server consumes them only on success), so failures are retryable.
  const uploadDocuments = async (applicationId, capabilities, entries) => {
    const caps = new Map((capabilities || []).map((u) => [u.documentId, u.capability]))
    return Promise.all(entries.map(async (doc) => {
      const file = documentFiles.current.get(doc.id)
      if (!file) {
        return { id: doc.id, fileName: doc.fileName, categoryId: doc.documentCategory, ok: false, message: 'File missing. Re-attach this document and retry.' }
      }
      const upload = await uploadPrivateDocument(
        file,
        { applicationId, documentId: doc.id },
        caps.get(doc.id),
      )
      return {
        id: doc.id,
        fileName: doc.fileName,
        categoryId: doc.documentCategory,
        ok: upload.ok,
        message: upload.ok ? '' : (upload.message || 'Upload failed. Please try again.'),
      }
    }))
  }

  const finishAfterUploads = (applicationId, outcomes) => {
    const failed = outcomes.filter((o) => !o.ok)
    const failedRequired = failed.filter((o) => isRequiredDocCategory(o.categoryId))
    if (failedRequired.length > 0) {
      setUploadError({ failed })
      showToast('Application saved, but required documents could not be uploaded. Please retry the upload — your application is kept.', 'error')
      return
    }
    setUploadError(null)
    if (failed.length > 0) {
      showToast('Application saved, but one or more optional documents could not be uploaded. You can contact support to re-upload.', 'error')
    }
    setReferenceId(applicationId)
    setSubmitted(true)
    showToast('Application submitted successfully', 'success')
  }

  const handleSubmit = async () => {
    if (!form.consentGiven) {
      setErrors((prev) => ({ ...prev, consentGiven: 'Consent is required to submit' }))
      showToast('Please accept the consent to submit', 'error')
      return
    }
    setSubmitting(true)
    try {
      const nonce = createFormNonce()
      const needs = form.purposeOfFunding.trim()
      // The browser never creates the authoritative record: the flat field
      // set is identical to the previous direct write, but it is persisted
      // by the Node backend (POST /api/applications), which returns the
      // server-generated application id plus upload capabilities.
      const values = {
        requestFor: 'athlete',
        fullName: form.athleteName,
        email: form.email,
        phone: form.phone || undefined,
        consentGiven: true,
        antiSpamToken: nonce,
        formNonce: nonce,
        athleteName: form.athleteName,
        athleteFields: {
          athleteName: form.athleteName,
          dateOfBirth: form.dateOfBirth,
          athleteSport: form.sport,
          sponsorshipNeeds: needs.length >= 10 ? needs : `${needs} ${form.majorAchievements}`.trim(),
          sponsorshipPurpose: form.purposeOfFunding,
          location: form.location,
          currentRanking: form.currentRanking || undefined,
          coach: form.coach || undefined,
          academy: form.academy || undefined,
          majorAchievements: form.majorAchievements || undefined,
          upcomingCompetitions: form.upcomingCompetitions || undefined,
          amountRequested: form.amountRequested ? Number(form.amountRequested) : undefined,
          documents: form.documents,
          socialMedia: form.socialMedia,
        },
      }
      const { documents: docEntries, ...application } = buildSponsorshipRequestDoc(values)
      const result = await submitPublicApplication({
        requestFor: 'athlete',
        formNonce: nonce,
        consentGiven: true,
        antiSpamToken: nonce,
        application,
        documents: docEntries,
      })
      if (!result.ok) {
        setSubmitting(false)
        showToast(result.message || 'Submission failed. Please try again.', 'error')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const pending = { applicationId: result.applicationId, uploads: result.uploads || [] }
      setSubmission(pending)
      const outcomes = await uploadDocuments(result.applicationId, pending.uploads, form.documents)
      setSubmitting(false)
      finishAfterUploads(result.applicationId, outcomes)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSubmitting(false)
      showToast('Submission failed. Please try again.', 'error')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleRetryUpload = async () => {
    if (!submission) return
    setSubmitting(true)
    try {
      const failedIds = new Set((uploadError?.failed || []).map((f) => f.id))
      const entries = form.documents.filter((d) => failedIds.has(d.id))
      const outcomes = await uploadDocuments(
        submission.applicationId,
        submission.uploads,
        entries.length > 0 ? entries : form.documents,
      )
      setSubmitting(false)
      finishAfterUploads(submission.applicationId, outcomes)
    } catch {
      setSubmitting(false)
      showToast('Upload retry failed. Please try again.', 'error')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (submitted) {
    return (
      <>
        <PageHero
          eyebrow="Application"
          title={
            <>
              Application <span className="accent">Submitted</span>
            </>
          }
          subtitle="Thank you for applying to USSCOS Trust."
          image="https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=1600&auto=format&fit=crop"
        />
        <section className="section section-light">
          <div className="container">
            <div className="success-screen">
              <span className="success-screen__icon">
                <CheckCircle2 size={44} />
              </span>
              <h2>Application Received!</h2>
              <p>
                Your application has been submitted successfully. Our review committee will evaluate it
                and get back to you. Reference ID: <strong>{referenceId}</strong>
              </p>
              <div className="hero__buttons" style={{ justifyContent: 'center' }}>
                <PrimaryButton to="/">BACK TO HOME</PrimaryButton>
                <SecondaryButton to="/athletes" dark>
                  EXPLORE FIGHTERS
                </SecondaryButton>
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHero
        eyebrow="Application"
        title={
          <>
            Apply for <span className="accent">Sponsorship</span>
          </>
        }
        subtitle="Complete the application in six simple steps. It takes about 10 minutes."
        image="https://images.unsplash.com/photo-1519834785169-98be25ec3f84?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light">
        <div className="container">
          <div className="step-form">
            {/* Progress indicator */}
            <div className="step-form__progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
              {STEPS.map((label, i) => (
                <div
                  key={label}
                  className={`step-form__progress-item ${
                    i === step ? 'step-form__progress-item--active' : i < step ? 'step-form__progress-item--complete' : ''
                  }`}
                >
                  <span className="step-form__progress-dot">{i < step ? <Check size={15} /> : i + 1}</span>
                  <span className="step-form__progress-label">{label}</span>
                </div>
              ))}
            </div>

            <div className="step-form__card">
              {step === 0 && (
                <>
                  <h3>Personal Information</h3>
                  <p className="step-form__sub">Tell us about yourself.</p>
                  <div className="form-grid">
                    <Field label="Fighter Name" name="athleteName" value={form.athleteName} onChange={setField} error={errors.athleteName} required placeholder="e.g. Arjun R." />
                    <Field label="Date of Birth" name="dateOfBirth" value={form.dateOfBirth} onChange={setField} error={errors.dateOfBirth} required type="date" />
                    <Field label="Location" name="location" value={form.location} onChange={setField} error={errors.location} required placeholder="City, State" />
                    <Field label="Phone" name="phone" value={form.phone} onChange={setField} error={errors.phone} required placeholder="+91 ..." />
                    <Field label="Email" name="email" value={form.email} onChange={setField} error={errors.email} required type="email" placeholder="you@example.com" />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h3>Sport Information</h3>
                  <p className="step-form__sub">Details about your discipline and training setup.</p>
                  <div className="form-grid">
                    <Field label="Sport / Discipline" name="sport" value={form.sport} onChange={setField} error={errors.sport} required placeholder="e.g. Boxing, Muay Thai, MMA" />
                    <Field label="Current Ranking" name="currentRanking" value={form.currentRanking} onChange={setField} error={errors.currentRanking} placeholder="e.g. No. 3 National" />
                    <Field label="Coach" name="coach" value={form.coach} onChange={setField} error={errors.coach} required placeholder="Coach name" />
                    <Field label="Academy" name="academy" value={form.academy} onChange={setField} error={errors.academy} required placeholder="Academy / gym name" />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h3>Achievements</h3>
                  <p className="step-form__sub">Your competitive record and what's coming up.</p>
                  <TextArea label="Major Achievements" name="majorAchievements" value={form.majorAchievements} onChange={setField} error={errors.majorAchievements} required placeholder="List medals, titles, and notable results..." />
                  <TextArea label="Upcoming Competitions" name="upcomingCompetitions" value={form.upcomingCompetitions} onChange={setField} error={errors.upcomingCompetitions} required placeholder="List competitions you plan to enter..." />
                </>
              )}

              {step === 3 && (
                <>
                  <h3>Sponsorship Requirement</h3>
                  <p className="step-form__sub">Help us understand the support you need.</p>
                  <div className="form-grid">
                    <Field label="Amount Requested (₹)" name="amountRequested" value={form.amountRequested} onChange={setField} error={errors.amountRequested} required type="number" placeholder="e.g. 50000" />
                  </div>
                  <TextArea label="Purpose of Funding" name="purposeOfFunding" value={form.purposeOfFunding} onChange={setField} error={errors.purposeOfFunding} required placeholder="Describe how the funds will be used..." />
                </>
              )}

              {step === 4 && (
                <>
                  <h3>Documents</h3>
                  <p className="step-form__sub">
                    Provide the documents below so the review committee can verify your
                    application. Upload a clear copy of each required document.
                  </p>
                  <DocumentCollection
                    categories={FIGHTER_DOCUMENT_CATEGORIES}
                    documents={form.documents}
                    typesByCategory={form.documentTypes}
                    errors={docErrors}
                    onTypeChange={setDocumentType}
                    onAttachFile={handleAttachFile}
                    onRemove={handleRemoveDocument}
                  />
                </>
              )}

              {step === 5 && (
                <>
                  <h3>Social Media</h3>
                  <p className="step-form__sub">Optional — helps us showcase your journey if sponsored.</p>
                  <div className="form-grid">
                    <Field label="Instagram" name="instagram" value={form.socialMedia.instagram} onChange={(n, v) => setSocial(n, v)} placeholder="@handle" />
                    <Field label="Facebook" name="facebook" value={form.socialMedia.facebook} onChange={(n, v) => setSocial(n, v)} placeholder="Profile URL" />
                    <Field label="LinkedIn" name="linkedin" value={form.socialMedia.linkedin} onChange={(n, v) => setSocial(n, v)} placeholder="Profile URL" />
                    <Field label="Other" name="other" value={form.socialMedia.other} onChange={(n, v) => setSocial(n, v)} placeholder="YouTube, TikTok, etc." />
                  </div>
                </>
              )}

              {/* Review screen as step 6 visual */}
              {step === 5 && (
                <div className="review-section" style={{ marginTop: 'var(--space-6)' }}>
                  <h4>Review Your Application</h4>
                  <dl>
                    <div><dt>Name</dt><dd>{form.athleteName}</dd></div>
                    <div><dt>Sport</dt><dd>{form.sport}</dd></div>
                    <div><dt>Coach</dt><dd>{form.coach}</dd></div>
                    <div><dt>Academy</dt><dd>{form.academy}</dd></div>
                    <div><dt>Amount Requested</dt><dd>₹{Number(form.amountRequested || 0).toLocaleString('en-IN')}</dd></div>
                    <div><dt>Documents</dt><dd>{form.documents.length} attached</dd></div>
                  </dl>
                </div>
              )}

              {step === 5 && (
                <label
                  className="contact-form__consent"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-light-muted)', marginTop: 'var(--space-3)' }}
                >
                  <input
                    type="checkbox"
                    checked={!!form.consentGiven}
                    onChange={(e) => setField('consentGiven', e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>I consent to the USSCOS Trust contacting me about this sponsorship application, and agree to the processing of my details for that purpose. See our <a href="/privacy">Privacy Policy</a>.</span>
                </label>
              )}
              {step === 5 && errors.consentGiven && (
                <span className="form-field__error" style={{ display: 'block', marginTop: 'var(--space-1)' }}>{errors.consentGiven}</span>
              )}
              {step === 5 && uploadError && (
                <div className="form-field__error" style={{ display: 'block', marginTop: 'var(--space-3)' }}>
                  Required document upload failed: {uploadError.failed.map((f) => f.fileName).join(', ')}. Your application is saved — fix the issue and retry the upload.
                </div>
              )}

              <div className="step-form__nav">
                <SecondaryButton onClick={handleBack} disabled={step === 0} dark>
                  <ArrowLeft size={18} /> Previous
                </SecondaryButton>
                {step < STEPS.length - 1 ? (
                  <PrimaryButton onClick={handleNext}>
                    Next <ArrowRight size={18} />
                  </PrimaryButton>
                ) : submission && uploadError ? (
                  <PrimaryButton onClick={handleRetryUpload} disabled={submitting}>
                    {submitting ? 'Uploading...' : 'RETRY DOCUMENT UPLOAD'}
                  </PrimaryButton>
                ) : (
                  <PrimaryButton onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'SUBMIT APPLICATION'}
                  </PrimaryButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
