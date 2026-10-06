// @vitest-environment jsdom
/**
 * Payment success experience.
 *
 * The /payment/success page renders ONLY a backend-verified PAID receipt
 * (persisted by the payer after runPaymentFlow() stage:"success", i.e. after
 * /api/payments/verify confirmed PAID). Refresh-safe: the page only reads
 * sessionStorage and never initiates a payment.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import PaymentSuccess from "@/pages/public/PaymentSuccess.jsx"
import {
  clearVerifiedReceipt,
  readVerifiedReceipt,
  saveVerifiedReceipt,
  secondaryActionFor,
} from "@/services/payments/payment-receipt"

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/" element={<div>HOME PAGE</div>} />
        <Route path="/donate" element={<div>DONATE PAGE</div>} />
        <Route path="/sponsorships" element={<div>SPONSORSHIPS PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const RECEIPT = {
  purpose: "DONATION" as const,
  amount: 1000,
  currency: "INR" as const,
  paymentId: "pay_test_success_1",
  orderId: "order_test_success_1",
  completedAt: "2026-09-20T10:30:00.000Z",
  entityTitle: "Donation",
}

beforeEach(() => {
  clearVerifiedReceipt()
  vi.restoreAllMocks()
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    writable: true,
    configurable: true,
  })
})

describe("payment receipt storage", () => {
  it("round-trips a verified receipt", () => {
    saveVerifiedReceipt(RECEIPT)
    const read = readVerifiedReceipt()
    expect(read).toMatchObject({
      purpose: "DONATION",
      amount: 1000,
      paymentId: "pay_test_success_1",
      orderId: "order_test_success_1",
    })
  })

  it("returns null when absent or corrupt", () => {
    expect(readVerifiedReceipt()).toBeNull()
    sessionStorage.setItem("usscos:last-paid-receipt", "not-json{{{")
    expect(readVerifiedReceipt()).toBeNull()
    sessionStorage.setItem(
      "usscos:last-paid-receipt",
      JSON.stringify({ purpose: "DONATION", amount: 0, paymentId: "", orderId: "", completedAt: "" }),
    )
    expect(readVerifiedReceipt()).toBeNull()
  })

  it("maps secondary actions per purpose", () => {
    expect(secondaryActionFor("DONATION")).toEqual({ label: "MAKE ANOTHER DONATION", to: "/donate" })
    expect(secondaryActionFor("SPONSORSHIP")).toEqual({ label: "BACK TO SPONSORSHIPS", to: "/sponsorships" })
    expect(secondaryActionFor("EVENT")).toEqual({ label: "BACK TO EVENTS", to: "/events" })
    expect(secondaryActionFor("OTHER")).toBeNull()
  })
})

describe("PaymentSuccess page", () => {
  it("renders the verified receipt with all required details and actions", () => {
    saveVerifiedReceipt(RECEIPT)
    renderAt("/payment/success")

    // PageHero title + section heading both confirm success
    expect(
      screen.getAllByRole("heading", { name: /Payment Successful/i }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/pay_test_success_1/i)).toBeInTheDocument()
    expect(screen.getByText(/order_test_success_1/i)).toBeInTheDocument()
    // Purpose label + entity title rendered exactly
    expect(screen.getAllByText("Donation").length).toBeGreaterThanOrEqual(1)
    // Amount in en-IN format + purpose + entity title visible
    expect(screen.getByText(/₹1,000/i)).toBeInTheDocument()
    // Back to Home always present
    expect(screen.getByRole("link", { name: /BACK TO HOME/i })).toBeInTheDocument()
    // Purpose-specific secondary action
    expect(screen.getByRole("link", { name: /MAKE ANOTHER DONATION/i })).toBeInTheDocument()
  })

  it("renders sponsorship receipts with the sponsorship return action", () => {
    saveVerifiedReceipt({ ...RECEIPT, purpose: "SPONSORSHIP", entityTitle: "Arjun R." })
    renderAt("/payment/success")

    expect(
      screen.getAllByRole("heading", { name: /Payment Successful/i }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Arjun R\./i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /BACK TO SPONSORSHIPS/i })).toBeInTheDocument()
  })

  it("shows the no-receipt state when nothing was verified (never a false success)", () => {
    renderAt("/payment/success")

    expect(screen.getByRole("heading", { name: /No Verified Payment Found/i })).toBeInTheDocument()
    expect(screen.queryByText(/pay_test_success_1/i)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /BACK TO HOME/i })).toBeInTheDocument()
  })

  it("survives a refresh: re-render reads the same receipt without new payment calls", () => {
    saveVerifiedReceipt(RECEIPT)
    const { unmount } = render(
      <MemoryRouter initialEntries={["/payment/success"]}>
        <Routes>
          <Route path="/payment/success" element={<PaymentSuccess />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText(/pay_test_success_1/i)).toBeInTheDocument()
    unmount()
    // "Refresh": brand-new render, no payment code runs, same receipt shows.
    renderAt("/payment/success")
    expect(screen.getByText(/pay_test_success_1/i)).toBeInTheDocument()
    expect(screen.getByText(/order_test_success_1/i)).toBeInTheDocument()
  })
})
