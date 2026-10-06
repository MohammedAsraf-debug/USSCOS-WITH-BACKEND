import { useState } from 'react'
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react'
import { FacebookIcon, InstagramIcon, TwitterIcon, LinkedinIcon, YoutubeIcon } from '../../components/common/SocialIcons.jsx'
import PageHero from '../../components/common/PageHero.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import FormInput, { TextArea } from '../../components/common/FormInput.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { createFirestoreAdapter, createFormNonce } from '@/services/firestore-adapter'
import { isValidPhone, PHONE_ERROR, MAX_PHONE_LENGTH, sanitizePhoneInput } from '@/lib/phone'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'

const initialForm = { name: '', email: '', phone: '', subject: '', message: '', consentGiven: false }

export default function Contact() {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const { showToast } = useToast()
  const { content } = usePageContent('contact')
  const contact = content

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
    if (!form.subject.trim()) errs.subject = 'Subject is required'
    if (!form.message.trim()) errs.message = 'Message is required'
    if (!form.consentGiven) errs.consentGiven = 'Please consent to be contacted'

    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('Please check the highlighted fields', 'error')
      return
    }

    setSubmitting(true)
    try {
      const adapter = createFirestoreAdapter()
      const result = await adapter.submitContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        consentGiven: form.consentGiven,
        antiSpamToken: 'web-submit',
        formNonce: createFormNonce(),
      })
      if (result.ok) {
        setSent(true)
        showToast('Message sent successfully', 'success')
      } else {
        showToast(result.message ?? 'Message could not be sent. Please try again.', 'error')
      }
    } catch {
      showToast('Message could not be sent. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const socials = [
    { Icon: FacebookIcon, label: 'Facebook' },
    { Icon: InstagramIcon, label: 'Instagram' },
    { Icon: TwitterIcon, label: 'Twitter' },
    { Icon: LinkedinIcon, label: 'LinkedIn' },
    { Icon: YoutubeIcon, label: 'YouTube' },
  ]

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1600&auto=format&fit=crop"
      />

      {/* Contact info cards */}
      <section className="section section-light">
        <div className="container">
          <Reveal stagger className="contact-info-grid">
            <div className="contact-info-card">
              <span className="contact-info-card__icon"><Mail size={24} /></span>
              <h3>{contact.emailCardTitle}</h3>
              <p><a href={`mailto:${contact.email}`} style={{ color: 'var(--primary-red)' }}>{contact.email}</a></p>
            </div>
            <div className="contact-info-card">
              <span className="contact-info-card__icon"><Phone size={24} /></span>
              <h3>{contact.phoneCardTitle}</h3>
              <p><a href={`tel:${contact.phone.replace(/\s/g, '')}`} style={{ color: 'var(--primary-red)' }}>{contact.phone}</a></p>
            </div>
            <div className="contact-info-card">
              <span className="contact-info-card__icon"><MapPin size={24} /></span>
              <h3>{contact.addressCardTitle}</h3>
              <p>{contact.address}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Form + map */}
      <section className="section section-white">
        <div className="container">
          <Reveal className="about-preview">
            <div>
              <span className="eyebrow">{contact.formEyebrow}</span>
              <h2 className="about-preview__heading">{renderRichText(contact.formTitle)}</h2>
              <p className="about-preview__text">{contact.formText}</p>

              <div className="footer__socials" style={{ marginTop: 'var(--space-5)' }}>
                {socials.map(({ Icon, label }) => (
                  <span
                    key={label}
                    className="footer__social footer__social--light"
                    aria-hidden="true"
                    style={{ borderColor: 'var(--border-light)', color: 'var(--text-light-muted)' }}
                  >
                    <Icon size={18} />
                  </span>
                ))}
              </div>
            </div>

            <div>
              {sent ? (
                <div className="success-screen">
                  <span className="success-screen__icon">
                    <CheckCircle2 size={44} />
                  </span>
                  <h2>{contact.successTitle}</h2>
                  <p>Thank you, {form.name.split(' ')[0]}. {contact.successText}</p>
                  <PrimaryButton onClick={() => { setSent(false); setForm(initialForm) }}>{contact.sendAnotherLabel}</PrimaryButton>
                </div>
              ) : (
                <form className="contact-form" onSubmit={handleSubmit} noValidate>
                  <FormInput label={contact.nameLabel} name="name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder={contact.namePlaceholder} error={errors.name} required />
                  <div className="form-grid">
                    <FormInput label={contact.emailLabel} name="email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder={contact.emailPlaceholder} error={errors.email} required />
                    <FormInput label={contact.phoneLabel} name="phone" value={form.phone} onChange={(e) => setField('phone', sanitizePhoneInput(e.target.value))} placeholder={contact.phonePlaceholder} maxLength={MAX_PHONE_LENGTH} inputMode="numeric" error={errors.phone} required />
                  </div>
                  <FormInput label={contact.subjectLabel} name="subject" value={form.subject} onChange={(e) => setField('subject', e.target.value)} placeholder={contact.subjectPlaceholder} error={errors.subject} required />
                  <TextArea label={contact.messageLabel} name="message" value={form.message} onChange={(e) => setField('message', e.target.value)} placeholder={contact.messagePlaceholder} error={errors.message} required rows={5} />
                  <label className="contact-form__consent" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-light-muted)', marginBottom: 'var(--space-4)' }}>
                    <input
                      type="checkbox"
                      checked={form.consentGiven}
                      onChange={(e) => setField('consentGiven', e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <span>{contact.consentText}</span>
                  </label>
                  {errors.consentGiven && <span className="form-field__error" style={{ display: 'block', marginTop: '-0.5rem', marginBottom: 'var(--space-3)' }}>{errors.consentGiven}</span>}
                  <PrimaryButton type="submit" disabled={submitting} size="lg">
                    <Send size={18} /> {submitting ? contact.submittingLabel : contact.submitLabel}
                  </PrimaryButton>
                </form>
              )}
            </div>
          </Reveal>

          <div className="spacer-lg"></div>

          <div className="map-placeholder">
            <iframe
              title="USSCOS location map"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(contact.address)}&z=15&output=embed`}
              width="100%"
              height="360"
              style={{ border: 0, borderRadius: 'var(--radius-md)' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>
    </>
  )
}