import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, GraduationCap, ArrowRight, User } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import FormInput, { TextArea } from '../../components/common/FormInput.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { usePublicAthlete, usePublicAthletes } from '@/hooks/use-firestore'
import { createFirestoreAdapter, createFormNonce } from '@/services/firestore-adapter'
import { runPaymentFlow } from '@/services/payments/payment-flow'
import { saveVerifiedReceipt } from '@/services/payments/payment-receipt'
import { paymentsConfigured } from '@/lib/config'
import { isValidPhone, PHONE_ERROR, MAX_PHONE_LENGTH, sanitizePhoneInput } from '@/lib/phone'
import { useToast } from '../../context/ToastContext.jsx'

const initialForm = {
  sponsorName: '',
  sponsorCompany: '',
  email: '',
  phone: '',
  amount: '',
  supportType: '',
  details: '',
}

export default function SponsorRequest() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') === 'academy' ? 'academy' : 'athlete'
  const selectedAthleteId = searchParams.get('athlete') || ''
  const selectedAcademy = searchParams.get('academy') || ''

  const isAcademy = type === 'academy'
  const { data: athlete, isLoading: athleteLoading } = usePublicAthlete(
    isAcademy ? '' : selectedAthleteId,
  )
  const { data: fighters, isLoading: fightersLoading, isError: fightersError } = usePublicAthletes()
  const athleteReference = isAcademy
    ? selectedAcademy
    : athlete?.fullName
      ? `${athlete.fullName}${selectedAthleteId ? ` (${selectedAthleteId})` : ''}`
      : selectedAthleteId

  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [paymentContext, setPaymentContext] = useState(null)
  // Verification-failure state: the PAY button below retries with the same
  // idempotency key, so the server reuses the open order — never a double charge.
  const [payError, setPayError] = useState(null)
  const { showToast } = useToast()

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async () => {
    const errs = {}
    if (!form.sponsorName.trim()) errs.sponsorName = 'Sponsor name is required'
    if (!form.email.trim()) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email address'
    }
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required'
    } else if (!isValidPhone(form.phone)) {
      errs.phone = PHONE_ERROR
    }
    const amountParsed = Number(form.amount)
    if (!form.amount.trim() || !Number.isFinite(amountParsed) || amountParsed <= 0) {
      errs.amount = 'Enter a valid sponsorship amount'
    }
    if (!form.details.trim()) errs.details = 'Sponsorship details are required'

    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('Please check the highlighted fields', 'error')
      return
    }

    setSubmitting(true)
    try {
      const adapter = createFirestoreAdapter()
      const nonce = createFormNonce()
      const athleteRef =
        !isAcademy && selectedAthleteId && athlete?.fullName
          ? { id: athlete.id, name: athlete.fullName, sport: athlete.sport }
          : null
      const result = await adapter.submitSponsorApplication(
        {
          organizationName: form.sponsorCompany || form.sponsorName,
          contactName: form.sponsorName,
          email: form.email,
          phone: form.phone || undefined,
          organizationType: 'individual',
          sponsorshipLevel: 'custom',
          amount: Number(form.amount),
          message: `${isAcademy ? 'Academy' : 'Fighter'}: ${athleteReference}. ${form.supportType ? 'Type: ' + form.supportType + '. ' : ''}${form.details}`,
          consentGiven: true,
          antiSpamToken: 'web-submit',
          formNonce: nonce,
        },
        athleteRef,
      )
      if (result.ok) {
        setPaymentContext({
          applicationId: result.id,
          amount: Math.round(amountParsed),
          customer: {
            name: form.sponsorName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
          },
          entity: {
            kind: isAcademy ? 'academy' : 'athlete',
            id: isAcademy ? selectedAcademy : selectedAthleteId,
            title: athleteReference,
          },
          idempotencyKey: nonce,
        })
        showToast('Sponsorship request saved — ready for payment', 'success')
      } else {
        showToast(result.message ?? 'Submission failed. Please try again.', 'error')
      }
    } catch {
      showToast('Submission failed. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayment = async () => {
    if (!paymentContext) return
    setSubmitting(true)
    try {
      const outcome = await runPaymentFlow({
        purpose: 'SPONSORSHIP',
        amount: paymentContext.amount,
        customer: paymentContext.customer,
        entity: paymentContext.entity,
        idempotencyKey: paymentContext.idempotencyKey,
        description: `Sponsorship for ${athleteReference}`,
      })

      if (outcome.stage === 'success') {
        // Verified PAID by the backend — persist the receipt and show the
        // dedicated success screen. Checkout success alone never gets here.
        saveVerifiedReceipt({
          purpose: 'SPONSORSHIP',
          amount: paymentContext.amount,
          currency: 'INR',
          paymentId: outcome.paymentId,
          orderId: outcome.orderId,
          completedAt: outcome.paymentCompletedAt,
          entityTitle: athleteReference,
        })
        setPaymentContext(null)
        setPayError(null)
        navigate('/payment/success')
        return
      }

      if (outcome.stage === 'dismissed') {
        showToast('Payment window closed. Your sponsorship request is saved; you can try again.', 'success')
        return
      }

      setPayError({ message: outcome.stage === 'not-configured'
        ? 'Online payments are not configured yet. Your sponsorship request is saved.'
        : outcome.message ?? 'The payment could not be confirmed. Please try again.' })
      showToast(
        outcome.stage === 'not-configured'
          ? 'Online payments are not configured yet. Your sponsorship request is saved.'
          : outcome.message ?? 'The payment could not be confirmed. Please try again.',
        outcome.stage === 'not-configured' ? 'success' : 'error',
      )
    } catch {
      showToast('The payment could not be completed. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAcademy && !selectedAthleteId) {
    if (fightersLoading) {
      return (
        <section className="section section-light">
          <LoadingState label="Loading fighters" />
        </section>
      )
    }

    if (fightersError) {
      return (
        <section className="section section-light">
          <div className="container">
            <EmptyState
              title="Unable to load fighters"
              description="There was a problem connecting to the fighters list. Please try again later."
            />
            <div style={{ textAlign: 'center' }}>
              <SecondaryButton to="/athletes" dark>
                BACK TO FIGHTERS
              </SecondaryButton>
            </div>
          </div>
        </section>
      )
    }

    if (!fighters || fighters.length === 0) {
      return (
        <section className="section section-light">
          <div className="container">
            <EmptyState
              title="Select a Fighter"
              description="Please choose the fighter you'd like to support from the fighters list."
            />
            <div style={{ textAlign: 'center' }}>
              <SecondaryButton to="/athletes" dark>
                BACK TO FIGHTERS
              </SecondaryButton>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className="section section-light">
        <div className="container">
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            <div className="step-form__card">
              <h3>Select a Fighter</h3>
              <p className="step-form__sub">
                Choose the fighter you'd like to sponsor to continue to the sponsorship and payment
                flow.
              </p>
            </div>
            <div className="athletes-grid" style={{ marginTop: 'var(--space-5)' }}>
              {fighters.map((fighter) => (
                <button
                  key={fighter.id}
                  type="button"
                  className="sponsor-fighter"
                  onClick={() =>
                    navigate(
                      `/sponsorships/sponsor?type=athlete&athlete=${encodeURIComponent(fighter.id)}`,
                    )
                  }
                >
                  {fighter.profileImageUrl ? (
                    <img
                      className="sponsor-fighter__media"
                      src={fighter.profileImageUrl}
                      alt=""
                    />
                  ) : (
                    <span className="sponsor-fighter__media sponsor-fighter__media--fallback">
                      <User size={32} />
                    </span>
                  )}
                  <span className="sponsor-fighter__sport">{fighter.sport}</span>
                  <strong className="sponsor-fighter__name">{fighter.fullName}</strong>
                  <span className="sponsor-fighter__cta">
                    Continue <ArrowRight size={16} />
                  </span>
                </button>
              ))}
            </div>
            <div className="hero__buttons" style={{ justifyContent: 'center', marginTop: 'var(--space-6)' }}>
              <SecondaryButton to="/sponsorships" dark>
                BACK TO SPONSORSHIPS
              </SecondaryButton>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!isAcademy && athleteLoading) {
    return (
      <section className="section section-light">
        <LoadingState label="Loading fighter" />
      </section>
    )
  }

  if (!isAcademy && !athlete) {
    return (
      <section className="section section-light">
        <div className="container">
          <EmptyState
            title="Fighter not found"
            description="The fighter you're looking for doesn't exist or has been removed."
          />
          <div style={{ textAlign: 'center' }}>
            <SecondaryButton to="/athletes" dark>
              BACK TO FIGHTERS
            </SecondaryButton>
          </div>
        </div>
      </section>
    )
  }

  if (paymentContext) {
    return (
      <section className="section section-light">
        <div className="container">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className="success-screen">
              <span className="success-screen__icon">
                <CheckCircle2 size={44} />
              </span>
              <h2>Ready to Complete Your Sponsorship</h2>
              <p>
                Your sponsorship request for <strong>{athleteReference}</strong> has been saved. Complete the
                contribution of <strong>₹{paymentContext.amount.toLocaleString('en-IN')}</strong> securely now.
              </p>
              {payError && (
                <div className="form-field__error" style={{ display: 'block', marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  Payment could not be verified: {payError.message} No amount has been collected unless Razorpay
                  says otherwise — you can safely retry below.
                </div>
              )}
              {paymentsConfigured ? (
                <PrimaryButton onClick={handlePayment} size="lg" disabled={submitting}>
                  {submitting ? 'OPENING PAYMENT...' : `PAY ₹${paymentContext.amount.toLocaleString('en-IN')}`}{' '}
                  <ArrowRight size={18} />
                </PrimaryButton>
              ) : (
                <p>
                  Online payments are not configured yet. Your request has been saved and the USSCOS team will
                  contact you to arrange payment.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <PageHero
        eyebrow="Sponsor Request"
        title={
          <>
            Sponsor {isAcademy ? 'an' : 'This'} <span className="accent">{isAcademy ? 'Academy' : 'Fighter'}</span>
          </>
        }
        subtitle="Support a fighter directly. Share your sponsorship details and an online payment will be prepared for your commitment."
        image="https://images.unsplash.com/photo-1517963879433-6ad2b056d712?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light">
        <div className="container">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className="step-form__card">
              <h3>Sponsor Request</h3>
              <p className="step-form__sub">
                Your selected {isAcademy ? 'academy' : 'fighter'} is automatically associated with this request.
              </p>

              <div className="info-block" style={{ marginBottom: 'var(--space-6)' }}>
                <h3>{isAcademy ? 'Selected Academy' : 'Selected Fighter'}</h3>
                <ul>
                  <li>
                    <GraduationCap size={18} />
                    {!isAcademy && athlete?.profileImageUrl ? (
                      <img
                        className="sponsor-request__avatar"
                        src={athlete.profileImageUrl}
                        alt=""
                      />
                    ) : null}
                    <strong>{isAcademy ? selectedAcademy : (athlete?.fullName ?? selectedAthleteId)}</strong>
                    {!isAcademy && athlete?.sport ? <span> — {athlete.sport}</span> : null}
                  </li>
                </ul>
              </div>

              <div className="form-grid">
                <FormInput
                  label="Sponsor Name"
                  name="sponsorName"
                  value={form.sponsorName}
                  onChange={(e) => setField('sponsorName', e.target.value)}
                  error={errors.sponsorName}
                  required
                  placeholder="Your full name"
                />
                <FormInput
                  label="Company / Organization Name"
                  name="sponsorCompany"
                  value={form.sponsorCompany}
                  onChange={(e) => setField('sponsorCompany', e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="form-grid">
                <FormInput
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  error={errors.email}
                  required
                  placeholder="you@example.com"
                />
                <FormInput
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', sanitizePhoneInput(e.target.value))}
                  error={errors.phone}
                  required
                  placeholder="+91 00000 00000"
                  maxLength={MAX_PHONE_LENGTH}
                  inputMode="numeric"
                />
              </div>

              <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
                <FormInput
                  label="Sponsorship Amount (₹)"
                  name="amount"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  error={errors.amount}
                  placeholder="e.g. 25000"
                />
                <FormInput
                  label="Support Type"
                  name="supportType"
                  value={form.supportType}
                  onChange={(e) => setField('supportType', e.target.value)}
                  placeholder="e.g. Equipment / Training / Travel"
                />
              </div>

              <div style={{ marginTop: 'var(--space-4)' }}>
                <TextArea
                  label="Sponsorship Details"
                  name="details"
                  value={form.details}
                  onChange={(e) => setField('details', e.target.value)}
                  error={errors.details}
                  required
                  placeholder="Describe the support you'd like to provide or the specific needs you're covering."
                />
              </div>

              <div className="hero__buttons" style={{ marginTop: 'var(--space-6)' }}>
                <PrimaryButton onClick={handleSubmit} size="lg" disabled={submitting}>
                  {submitting ? 'SAVING...' : 'CONTINUE TO PAYMENT'} <ArrowRight size={18} />
                </PrimaryButton>
                <SecondaryButton to="/sponsorships" size="lg">
                  CANCEL
                </SecondaryButton>
              </div>

              <p style={{ marginTop: 'var(--space-5)', fontSize: '0.85rem', color: 'var(--text-light-muted)' }}>
                Your sponsorship request will be saved first. You can then securely pay the amount you selected.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
