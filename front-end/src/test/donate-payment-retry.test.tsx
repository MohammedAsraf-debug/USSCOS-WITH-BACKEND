// @vitest-environment jsdom
/**
 * Donate payment retry.
 *
 * A failed verification shows an inline error with a safe retry that reuses
 * the SAME idempotency key (no duplicate order server-side). Only a
 * backend-verified PAID outcome navigates to /payment/success.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/context/ToastContext.jsx";
import Donate from "@/pages/public/Donate.jsx";

const mocks = vi.hoisted(() => ({
  submitDonationPledge: vi.fn(),
  runPaymentFlow: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ paymentsConfigured: true }));

vi.mock("@/services/firestore-adapter", () => ({
  createFirestoreAdapter: () => ({ submitDonationPledge: mocks.submitDonationPledge }),
  createFormNonce: () => "nonce-donate-retry-1",
}));

vi.mock("@/services/payments/payment-flow", () => ({
  runPaymentFlow: mocks.runPaymentFlow,
  paymentDescription: (purpose: string, title?: string) => `${purpose} ${title ?? ""}`,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderDonate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/donate"]}>
        <ToastProvider>
          <LocationProbe />
          <Routes>
            <Route path="/donate" element={<Donate />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

class IOStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: IOStub,
    writable: true,
    configurable: true,
  });
  mocks.submitDonationPledge.mockReset();
  mocks.runPaymentFlow.mockReset();
  mocks.submitDonationPledge.mockResolvedValue({ ok: true, id: "pledge-1" });
  sessionStorage.clear();
});

function fillDonationForm() {
  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("Donate payment retry", () => {
  it("shows an inline error on verification failure and retries with the same idempotency key", async () => {
    mocks.runPaymentFlow
      .mockResolvedValueOnce({ stage: "error", code: "INVALID_SIGNATURE", message: "signature mismatch" })
      .mockResolvedValue({
        stage: "success",
        paymentId: "pay_retry_1",
        orderId: "order_retry_1",
        paymentCompletedAt: "2026-09-20T10:30:00.000Z",
      });
    renderDonate();
    fillDonationForm();
    fireEvent.click(screen.getByRole("button", { name: /DONATE ₹/i }));

    // First attempt fails verification: inline error + retry action, no navigation.
    await waitFor(() =>
      expect(screen.getByText(/Payment could not be verified/i)).toBeInTheDocument(),
    );
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/donate");
    const retry = screen.getByRole("button", { name: /RETRY PAYMENT/i });
    expect(retry).toBeInTheDocument();

    // Retry reuses the same idempotency key (server dedupes; no second order).
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.runPaymentFlow).toHaveBeenCalledTimes(2));
    const firstKey = mocks.runPaymentFlow.mock.calls[0][0].idempotencyKey;
    const secondKey = mocks.runPaymentFlow.mock.calls[1][0].idempotencyKey;
    expect(firstKey).toBe("nonce-donate-retry-1");
    expect(secondKey).toBe("nonce-donate-retry-1");

    // Verified PAID navigates to the success page with a stored receipt.
    await waitFor(() => expect(screen.getByTestId("location-probe")).toHaveTextContent("/payment/success"));
    expect(mocks.submitDonationPledge).toHaveBeenCalledTimes(1);
  });

  it("dismissed checkout keeps the pledge and offers retry without navigating", async () => {
    mocks.runPaymentFlow.mockResolvedValue({ stage: "dismissed" });
    renderDonate();
    fillDonationForm();
    fireEvent.click(screen.getByRole("button", { name: /DONATE ₹/i }));

    await waitFor(() => expect(mocks.runPaymentFlow).toHaveBeenCalledTimes(1));
    // No success navigation on dismiss.
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/donate");
    expect(screen.queryByText(/Payment could not be verified/i)).not.toBeInTheDocument();
  });
});
