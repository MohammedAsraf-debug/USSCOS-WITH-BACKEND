import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, Shield, Users, Trophy, CheckCircle2, Wallet } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import SectionHeader from '../../components/common/SectionHeader.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import FieldInput from '../../components/common/FormInput.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'
import { createFirestoreAdapter, createFormNonce } from '@/services/firestore-adapter'
import { isValidPhone, PHONE_ERROR, MAX_PHONE_LENGTH, sanitizePhoneInput } from '@/lib/phone'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { runPaymentFlow } from '@/services/payments/payment-flow'
import { saveVerifiedReceipt } from '@/services/payments/payment-receipt'
import { paymentsConfigured } from '@/lib/config'

const PRESET_AMOUNTS = [500, 1000, 5000]

const impactIcons = [Shield, Users, Trophy]

export default function Donate() {
  const { content } = usePageContent('donate')
  const { content: formContent } = usePageContent('donate-form')
  const [amount, setAmount] = useState(1000)
  const [customAmount, setCustomAmount] = useState('')
  const [frequency, setFrequency] = useState('one-time')
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', consentGiven: false })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null)
  // Verification-failure state: shown inline with a safe retry (same
  // idempotency key, so the server reuses the open order — never a double charge).
  const [payError, setPayError] = useState(null)
  const payRetryRef = useRef(null)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const effectiveAmount = customAmount ? Number(customAmount) : amount

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setPayError(null)
  }

  const handlePreset = (value) => {
    setAmount(value)
    setCustomAmount('')
    setPayError(null)
  }

  const handleSubmit = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email'
    }
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required'
    } else if (!isValidPhone(form.phone)) {
      errs.phone = PHONE_ERROR
    }
    if (!effectiveAmount || effectiveAmount <= 0) errs.customAmount = 'Enter a valid amount'
    if (!form.consentGiven) errs.consentGiven = 'Please consent to be contacted'

    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('Please check the highlighted fields', 'error')
      return
    }

    setSubmitting(true)
    const nonce = createFormNonce()
    try {
      const adapter = createFirestoreAdapter()
      const result = await adapter.submitDonationPledge({
        fullName: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        amount: Math.round(effectiveAmount),
        frequency,
        message: form.message.trim() || undefined,
        consentGiven: form.consentGiven,
        antiSpamToken: nonce,
        formNonce: nonce,
      })
      if (!result.ok) {
        showToast(result.message ?? 'Your donation could not be submitted. Please try again.', 'error')
        return
      }

      if (frequency === 'monthly' || !paymentsConfigured) {
        setDone({ amount: Math.round(effectiveAmount), referenceId: result.id, frequency, paid: false })
        showToast(frequency === 'monthly' ? 'Monthly donation pledge received' : 'Donation pledge received', 'success')
        return
      }

      const paymentAttempt = {
        amount: Math.round(effectiveAmount),
        customer: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
        entity: { kind: 'donationPledge', id: result.id, title: 'Donation' },
        idempotencyKey: nonce,
      }
      payRetryRef.current = paymentAttempt
      setPayError(null)
      const outcome = await runPaymentFlow({
        purpose: 'DONATION',
        ...paymentAttempt,
      })

      if (outcome.stage === 'success') {
        // Verified PAID by the backend — persist the receipt and show the
        // dedicated success screen. Checkout success alone never gets here.
        saveVerifiedReceipt({
          purpose: 'DONATION',
          amount: Math.round(effectiveAmount),
          currency: 'INR',
          paymentId: outcome.paymentId,
          orderId: outcome.orderId,
          completedAt: outcome.paymentCompletedAt,
          entityTitle: 'Donation',
        })
        navigate('/payment/success')
        return
      }

      if (outcome.stage === 'dismissed') {
        showToast('Payment window closed. Your donation pledge is saved — you can try again.', 'success')
        return
      }

      setPayError({ message: outcome.message ?? 'The payment could not be confirmed. Please try again.' })
      showToast(outcome.message ?? 'The payment could not be confirmed. Please try again.', 'error')
    } catch {
      showToast('Your donation could not be submitted. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetryPayment = async () => {
    const attempt = payRetryRef.current
    if (!attempt) return
    setSubmitting(true)
    setPayError(null)
    try {
      const outcome = await runPaymentFlow({ purpose: 'DONATION', ...attempt })
      if (outcome.stage === 'success') {
        saveVerifiedReceipt({
          purpose: 'DONATION',
          amount: attempt.amount,
          currency: 'INR',
          paymentId: outcome.paymentId,
          orderId: outcome.orderId,
          completedAt: outcome.paymentCompletedAt,
          entityTitle: 'Donation',
        })
        navigate('/payment/success')
        return
      }
      if (outcome.stage === 'dismissed') {
        showToast('Payment window closed. Your donation pledge is saved — you can try again.', 'success')
        return
      }
      setPayError({ message: outcome.message ?? 'The payment could not be confirmed. Please try again.' })
      showToast(outcome.message ?? 'The payment could not be confirmed. Please try again.', 'error')
    } catch {
      setPayError({ message: 'The payment could not be completed. Please try again.' })
      showToast('The payment could not be completed. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1517673400267-0251440c45dc?q=80&w=1600&auto=format&fit=crop"
      />

      {/* Why support */}
      <section className="section section-dark">
        <div className="container">
          <SectionHeader
            dark
            eyebrow={content.whyEyebrow}
            title={renderRichText(content.whyTitle)}
            subtitle={content.whySubtitle}
          />
          <div className="impact-grid">
            {content.impacts.map((item, index) => {
              const Icon = impactIcons[index] ?? Shield
              return (
                <Reveal key={`${item.title}-${index}`}>
                  <div className="step-card">
                    <span className="step-card__icon">
                      <Icon size={24} />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* Donation form */}
      <section className="section section-light">
        <div className="container">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            {done ? (
              <div className="success-screen">
                <span className="success-screen__icon">
                  <CheckCircle2 size={44} />
                </span>
                <h2>{formContent.successTitle}</h2>
                <p>
                  Your {done.frequency === 'monthly' ? 'monthly donation pledge' : 'donation pledge'} of{' '}
                  <strong>₹{done.amount.toLocaleString('en-IN')}</strong> has been received. Reference ID:{' '}
                  <strong>{done.referenceId}</strong>. {formContent.successPledgeText}
                </p>
                <PrimaryButton onClick={() => setDone(null)}>
                  {formContent.anotherPledgeLabel}
                </PrimaryButton>
              </div>
            ) : (
              <div className="step-form__card">
                <h3>{formContent.formTitle}</h3>
                <p className="step-form__sub">{formContent.formSubtitle}</p>

                <SectionHeader
                  eyebrow={formContent.pledgeEyebrow}
                  title={renderRichText(formContent.pledgeTitle)}
                />

                <div className="donate-amounts">
                  {PRESET_AMOUNTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`donate-amount ${amount === value && !customAmount ? 'donate-amount--selected' : ''}`}
                      onClick={() => handlePreset(value)}
                    >
                      ₹{value.toLocaleString('en-IN')}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`donate-amount ${customAmount ? 'donate-amount--selected' : ''}`}
                    onClick={() => setAmount(0)}
                  >
                    {formContent.customOptionLabel}
                  </button>
                </div>

                <div style={{ maxWidth: '240px' }}>
                  <FieldInput
                    label={formContent.customAmountLabel}
                    name="customAmount"
                    type="number"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setPayError(null) }}
                    placeholder={formContent.customAmountPlaceholder}
                    error={errors.customAmount}
                  />
                </div>

                <div className="form-field" style={{ marginTop: 'var(--space-5)' }}>
                  <label>{formContent.contributionLabel}</label>
                  <div className="donate-amounts" style={{ marginTop: 'var(--space-2)' }}>
                    <button
                      type="button"
                      className={`donate-amount ${frequency === 'one-time' ? 'donate-amount--selected' : ''}`}
                      onClick={() => { setFrequency('one-time'); setPayError(null) }}
                    >
                      {formContent.oneTimeLabel}
                    </button>
                    <button
                      type="button"
                      className={`donate-amount ${frequency === 'monthly' ? 'donate-amount--selected' : ''}`}
                      onClick={() => { setFrequency('monthly'); setPayError(null) }}
                    >
                      {formContent.monthlyLabel}
                    </button>
                  </div>
                </div>

                <div className="spacer-md"></div>

                <SectionHeader
                  eyebrow={formContent.detailsEyebrow}
                  title={renderRichText(formContent.detailsTitle)}
                />

                <div className="form-grid">
                  <FieldInput label={formContent.nameLabel} name="name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder={formContent.namePlaceholder} error={errors.name} required />
                  <FieldInput label={formContent.emailLabel} name="email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder={formContent.emailPlaceholder} error={errors.email} required />
                  <FieldInput label={formContent.phoneLabel} name="phone" value={form.phone} onChange={(e) => setField('phone', sanitizePhoneInput(e.target.value))} placeholder={formContent.phonePlaceholder} maxLength={MAX_PHONE_LENGTH} inputMode="numeric" error={errors.phone} required />
                </div>

                <div className="form-field">
                  <label htmlFor="message">{formContent.messageLabel}</label>
                  <textarea
                    id="message"
                    name="message"
                    className="form-input"
                    rows={4}
                    value={form.message}
                    onChange={(e) => setField('message', e.target.value)}
                    placeholder={formContent.messagePlaceholder}
                  />
                </div>

                <div className="form-field">
                  <label style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.consentGiven}
                      onChange={(e) => setField('consentGiven', e.target.checked)}
                    />
                    <span style={{ fontSize: '0.92rem' }}>
                      {formContent.consentText}
                    </span>
                  </label>
                  {errors.consentGiven && (
                    <span className="form-field__error" style={{ display: 'block', marginTop: '0.4rem' }}>
                      {errors.consentGiven}
                    </span>
                  )}
                </div>

                <div
                  className="donate-note"
                  style={{
                    background: 'rgba(215,25,32,0.06)',
                    border: '1px solid rgba(215,25,32,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-4)',
                    fontSize: '0.88rem',
                    color: 'var(--text-light-muted)',
                    marginBottom: 'var(--space-5)',
                    display: 'flex',
                    gap: 'var(--space-3)',
                    alignItems: 'flex-start',
                  }}
                >
                  <Wallet size={18} style={{ flexShrink: 0, color: 'var(--primary-red)', marginTop: 2 }} />
                  <span>
                    <strong>{formContent.noteStrong}</strong>{' '}
                    {frequency === 'one-time' && paymentsConfigured
                      ? formContent.noteOnlineText
                      : formContent.notePledgeText}
                  </span>
                </div>

                {payError && (
                  <div className="form-field__error" style={{ display: 'block', marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                    Payment could not be verified: {payError.message} No amount has been collected unless Razorpay
                    says otherwise — you can safely retry.
                  </div>
                )}

                <PrimaryButton
                  onClick={payError ? handleRetryPayment : handleSubmit}
                  disabled={submitting}
                  size="lg"
                  full
                >
                  {submitting
                    ? formContent.submitProcessingLabel
                    : payError
                      ? `RETRY PAYMENT ${effectiveAmount ? `₹${effectiveAmount.toLocaleString('en-IN')}` : ''}`
                      : frequency === 'monthly'
                        ? `PLEDGE MONTHLY ${effectiveAmount ? `₹${effectiveAmount.toLocaleString('en-IN')}` : ''}`
                        : `DONATE ${effectiveAmount ? `₹${effectiveAmount.toLocaleString('en-IN')}` : ''}`}
                </PrimaryButton>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-light-muted)', marginTop: 'var(--space-3)', textAlign: 'center' }}>
                  {formContent.footnote} <Heart size={12} style={{ verticalAlign: '-1px', color: 'var(--primary-red)' }} />
                </p>

                <div style={{ marginTop: 'var(--space-5)', textAlign: 'center' }}>
                  <Link
                    to="/refund-cancellation"
                    className="link-arrow-light"
                    style={{ fontSize: '0.85rem' }}
                  >
                    {formContent.refundLinkLabel}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}