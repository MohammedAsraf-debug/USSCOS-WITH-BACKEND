import { useMemo } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import {
  formatDateTime,
  formatINR,
  purposeLabel,
  readVerifiedReceipt,
  secondaryActionFor,
  thankYouText,
} from '@/services/payments/payment-receipt'

/**
 * Payment success page (route: /payment/success).
 *
 * Renders ONLY a backend-verified PAID receipt persisted by the payer after
 * runPaymentFlow() returned stage:"success" (i.e. /api/payments/verify said
 * PAID). Refresh-safe: this page only reads sessionStorage and never starts,
 * retries, or re-verifies a payment, so reloading cannot create another
 * charge. Direct visits without a receipt show the no-receipt state.
 */
export default function PaymentSuccess() {
  const receipt = useMemo(() => readVerifiedReceipt(), [])

  if (!receipt) {
    return (
      <>
        <PageHero
          eyebrow="Payment"
          title={
            <>
              No Verified <span className="accent">Payment</span>
            </>
          }
          subtitle="We could not find a confirmed payment for this visit."
          image="https://images.unsplash.com/photo-1517673400267-0251440c45dc?q=80&w=1600&auto=format&fit=crop"
        />
        <section className="section section-light">
          <div className="container">
            <div className="success-screen">
              <span className="success-screen__icon">
                <AlertCircle size={44} />
              </span>
              <h2>No Verified Payment Found</h2>
              <p>
                This page only confirms payments verified by our payment server.
                If you just paid, please return to the donation or sponsorship
                flow — your payment reference from Razorpay is safe with you.
              </p>
              <div className="hero__buttons" style={{ justifyContent: 'center' }}>
                <PrimaryButton to="/">BACK TO HOME</PrimaryButton>
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }

  const secondary = secondaryActionFor(receipt.purpose)

  return (
    <>
      <PageHero
        eyebrow="Payment"
        title={
          <>
            Payment <span className="accent">Successful</span>
          </>
        }
        subtitle={thankYouText(receipt.purpose)}
        image="https://images.unsplash.com/photo-1517673400267-0251440c45dc?q=80&w=1600&auto=format&fit=crop"
      />
      <section className="section section-light">
        <div className="container">
          <div className="success-screen">
            <span className="success-screen__icon">
              <CheckCircle2 size={44} />
            </span>
            <h2>Payment Successful</h2>
            <p>{thankYouText(receipt.purpose)}</p>
            <div className="review-section" style={{ marginTop: 'var(--space-6)', textAlign: 'left' }}>
              <dl>
                <div><dt>Amount</dt><dd><strong>{formatINR(receipt.amount)}</strong></dd></div>
                <div><dt>Purpose</dt><dd>{purposeLabel(receipt.purpose)}</dd></div>
                {receipt.entityTitle ? <div><dt>For</dt><dd>{receipt.entityTitle}</dd></div> : null}
                <div><dt>Payment ID</dt><dd>{receipt.paymentId}</dd></div>
                <div><dt>Order / Reference ID</dt><dd>{receipt.orderId}</dd></div>
                <div><dt>Date &amp; Time</dt><dd>{formatDateTime(receipt.completedAt)}</dd></div>
              </dl>
            </div>
            <div className="hero__buttons" style={{ justifyContent: 'center' }}>
              <PrimaryButton to="/">BACK TO HOME</PrimaryButton>
              {secondary ? (
                <SecondaryButton to={secondary.to} dark>
                  {secondary.label}
                </SecondaryButton>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
