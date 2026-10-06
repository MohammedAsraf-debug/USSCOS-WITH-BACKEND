// @vitest-environment jsdom
/**
 * SEEKING SPONSORSHIP — TWO CLEAR CHOICES, EACH A COMPLETE WORKING FLOW
 *
 * Verified against the REAL restored pages + REAL service contracts:
 *
 *   1. INDIVIDUAL FIGHTER              → /apply          → Apply.jsx
 *        (6-step wizard; submitPublicApplication via the unified backend with
 *         requestFor:'athlete' + formNonce + consentGiven + enrichment
 *         location/sport/etc., then capability-gated document uploads)
 *   2. ACADEMY / TRAINING CENTER       → /apply/academy  → AcademyApplication
 *        (single-page form; submitPublicApplication with requestFor:'group',
 *         flat fields incl. location/memberCount/establishedYear enrichments,
 *         then capability-gated document uploads)
 *
 * Vitest hoists `vi.mock` factories above module-scope consts, so the mock
 * targets are created with `vi.hoisted` to keep the factory closures valid.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ToastProvider } from "@/context/ToastContext.jsx"
import SeekingSponsorship from "@/pages/public/SeekingSponsorship.jsx"
import Apply from "@/pages/public/Apply.jsx"
import AcademyApplication from "@/pages/public/AcademyApplication.jsx"

/* ==================================================================== */
/* mocks — vi.hoisted keeps factories above the consts they reference   */
/* ==================================================================== */

const { submitPublicApplication, uploadPrivateDocument } = vi.hoisted(() => ({
  submitPublicApplication: vi.fn(),
  uploadPrivateDocument: vi.fn(),
}))

vi.mock("@/services/public-application-submission", () => ({
  submitPublicApplication,
}))

vi.mock("@/services/private-documents", () => ({
  uploadPrivateDocument,
}))

function mockBackendSuccess(applicationId: string) {
  submitPublicApplication.mockImplementation(async (payload: {
    documents: Array<{ id: string }>
  }) => ({
    ok: true,
    applicationId,
    uploads: payload.documents.map((d) => ({ documentId: d.id, capability: `cap-${d.id}` })),
  }))
  uploadPrivateDocument.mockResolvedValue({ ok: true, storageRef: "doc_testref", fileUrl: null })
}

/* ==================================================================== */
/* jsdom environment stubs                                             */
/* ==================================================================== */

class IOStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: IOStub,
    writable: true,
  })
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ROStub,
    writable: true,
  })
  submitPublicApplication.mockReset()
  uploadPrivateDocument.mockReset()
})

function renderRouteAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <Routes>
            <Route path="/seeking-sponsorship" element={<SeekingSponsorship />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/apply/academy" element={<AcademyApplication />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function makePdf(name) {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "application/pdf" })
}

async function attachDocument(inputLabel, fileName) {
  fireEvent.change(screen.getByLabelText(inputLabel), {
    target: { files: [makePdf(fileName)] },
  })
  await waitFor(() => expect(screen.getByText(fileName)).toBeInTheDocument())
}

/* ==================================================================== */
/* 1 — landing page: two clear choices with working routes             */
/* ==================================================================== */

describe("Seeking Sponsorship — two clear choices", () => {
  it("renders TWO choice cards (Fighter + Academy) with correct links", () => {
    renderRouteAt("/seeking-sponsorship")

    expect(
      screen.getByRole("heading", { name: /Individual Fighter/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /Academy \/ Training Center/i }),
    ).toBeInTheDocument()

    const allLinks = screen.getAllByRole("link")
    const fighterHrefs = allLinks
      .map((a) => a.getAttribute("href"))
      .filter((h) => h === "/apply")
    const academyHrefs = allLinks
      .map((a) => a.getAttribute("href"))
      .filter((h) => h === "/apply/academy")

    expect(fighterHrefs.length).toBeGreaterThanOrEqual(1)
    expect(academyHrefs.length).toBeGreaterThanOrEqual(1)

    const fighterLink = allLinks.find((a) => a.getAttribute("href") === "/apply")
    const academyLink = allLinks.find(
      (a) => a.getAttribute("href") === "/apply/academy",
    )
    expect(fighterLink).toBeDefined()
    expect(academyLink).toBeDefined()
  })
})

/* ==================================================================== */
/* 2 — COMPLETE FIGHTER FLOW (wizard → submit 'athlete')               */
/* ==================================================================== */

describe("Complete Individual Fighter flow", () => {
  it("walks all 6 steps and submits an athlete request with nonce+consent", async () => {
    mockBackendSuccess("ATHLETE-2024-00921")
    renderRouteAt("/apply")

    const setAtStep = (re, val) =>
      fireEvent.change(screen.getByPlaceholderText(re), { target: { value: val } })

    /* step 0 — Personal */
    screen.getByText(/Personal Information/i)
    setAtStep(/e\.g\. Arjun R\./i, "Arjun R.")
    setAtStep(/City, State/i, "Mumbai, Maharashtra")
    setAtStep(/\+91/i, "9876543210")
    setAtStep(/you@example\.com/i, "arjun@example.com")
    const dob = document.getElementById("dateOfBirth") as HTMLInputElement
    expect(dob).toBeDefined()
    fireEvent.change(dob, { target: { value: "1999-08-14" } })
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* step 1 — Sport */
    screen.getByText(/Sport \/ Discipline/i)
    setAtStep(/e\.g\. Boxing, Muay Thai/i, "Boxing, Muay Thai")
    setAtStep(/e\.g\. No\. 3 National|No\. 3/i, "No. 3 National")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* step 2 — Achievements */
    setAtStep(/List medals, titles|Major Achievements/i, "State champion 2023; national bronze")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* step 3 — Funding */
    setAtStep(/e\.g\. 50000/i, "50000")
    setAtStep(/Describe how the funds/i, "Training, gear, and travel for nationals")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* step 4 — Documents (government ID + achievements + record + medical) */
    fireEvent.change(screen.getByLabelText(/Government ID type/i), {
      target: { value: "aadhaar-card" },
    })
    await attachDocument(/^Upload Government ID/i, "aadhar.pdf")
    await attachDocument(/^Upload Sports Achievement Proof/i, "sports-cert.pdf")
    await attachDocument(/^Upload Competition \/ Tournament Record/i, "fight-record.pdf")
    await attachDocument(/^Upload Medical Fitness Certificate/i, "medical.pdf")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* step 5 — Review + consent + submit */
    fireEvent.click(screen.getByRole("checkbox", { name: /I consent/i }))
    fireEvent.click(screen.getByRole("button", { name: /SUBMIT APPLICATION/i }))

    await waitFor(() =>
      expect(submitPublicApplication).toHaveBeenCalledTimes(1),
    )

    const payload = submitPublicApplication.mock.calls[0][0]
    expect(payload.requestFor).toBe("athlete")
    expect(payload.application.fullName).toBe("Arjun R.")
    expect(payload.application.sport).toBe("Boxing, Muay Thai")
    expect(payload.application.location).toBe("Mumbai, Maharashtra")
    expect(payload.application.amountRequested).toBe(50000)
    expect(payload.documents).toHaveLength(4)
    expect(payload.consentGiven).toBe(true)
    expect(payload.formNonce).toBeTruthy()

    await waitFor(() => expect(uploadPrivateDocument).toHaveBeenCalledTimes(4))

    expect(await screen.findByText(/Application Received!/i)).toBeInTheDocument()
    expect(screen.getByText(/ATHLETE-2024-00921/i)).toBeInTheDocument()
  })
})

/* ==================================================================== */
/* 3 — COMPLETE ACADEMY FLOW (submit 'group' with enrichments)         */
/* ==================================================================== */

describe("Complete Academy / Training Center flow", () => {
  it("walks the academy wizard and submits a full group request with enrichments", async () => {
    mockBackendSuccess("ACADEMY-2024-0033")
    renderRouteAt("/apply/academy")

    const set = (re, val) =>
      fireEvent.change(screen.getByPlaceholderText(re), { target: { value: val } })
    const next = () => fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* step 0 — Academy information */
    const academyName = document.getElementById("academyName") as HTMLInputElement
    fireEvent.change(academyName, { target: { value: "Pune Combat Academy" } })
    set(/e\.g\. Boxing, Muay Thai/i, "Boxing, Muay Thai, MMA")
    set(/e\.g\. Competitive/i, "Competitive")
    set(/e\.g\. 45/i, "45")
    set(/e\.g\. 2015/i, "2015")
    next()

    /* step 1 — Contact information */
    set(/Rahul M\./i, "Rahul M.")
    set(/you@example\.com/i, "academy@example.com")
    set(/\+91/i, "9123456780")
    set(/City, State/i, "Pune, Maharashtra")
    next()

    /* step 2 — Coaches & trainers (optional) */
    next()

    /* step 3 — Achievements */
    set(/Titles, medals/i, "12 state champions since 2015")
    next()

    /* step 4 — Funding */
    set(/e\.g\. 50000/i, "50000")
    set(/Sparring gear, ring/i, "Sparring gear, ring, travel for athletes")
    set(/Assist athletes with/i, "Assist athletes with travel and gear for competitions")
    next()

    /* step 5 — Documents (registration + representative ID) + consent + submit */
    fireEvent.change(screen.getByLabelText(/Academy Registration \/ Legal Proof type/i), {
      target: { value: "society-trust-registration" },
    })
    await attachDocument(/^Upload Academy Registration \/ Legal Proof/i, "society-registration.pdf")
    fireEvent.change(screen.getByLabelText(/Authorized Representative ID type/i), {
      target: { value: "aadhaar-card" },
    })
    await attachDocument(/^Upload Authorized Representative ID/i, "rep-aadhar.pdf")
    fireEvent.click(screen.getByRole("checkbox", { name: /I consent/i }))
    fireEvent.click(screen.getByRole("button", { name: /SUBMIT APPLICATION/i }))

    await waitFor(() =>
      expect(submitPublicApplication).toHaveBeenCalledTimes(1),
    )

    const payload = submitPublicApplication.mock.calls[0][0]
    expect(payload.requestFor).toBe("group")
    expect(payload.application.groupName).toBe("Pune Combat Academy")
    expect(payload.application.sport).toBe("Boxing, Muay Thai, MMA")
    expect(payload.application.level).toBe("competitive")
    expect(payload.application.memberCount).toBe(45)
    expect(payload.application.establishedYear).toBe(2015)
    expect(payload.application.location).toBe("Pune, Maharashtra")
    expect(payload.application.amountRequested).toBe(50000)
    expect(payload.application.sponsorshipNeeds).toContain("Sparring gear")
    expect(payload.documents).toHaveLength(2)
    expect(payload.consentGiven).toBe(true)
    expect(payload.formNonce).toBeTruthy()

    await waitFor(() => expect(uploadPrivateDocument).toHaveBeenCalledTimes(2))

    expect(await screen.findByText(/Application Received!/i)).toBeInTheDocument()
    expect(screen.getByText(/ACADEMY-2024-0033/i)).toBeInTheDocument()
  })

  it("disables submit while a submission is in flight (double-click protection)", async () => {
    let resolveSubmit = null
    submitPublicApplication.mockImplementationOnce(
      (payload) =>
        new Promise((resolve) => {
          resolveSubmit = () =>
            resolve({
              ok: true,
              applicationId: "ACADEMY-DBL-1",
              uploads: payload.documents.map((d) => ({ documentId: d.id, capability: `cap-${d.id}` })),
            })
        }),
    )
    uploadPrivateDocument.mockResolvedValue({ ok: true, storageRef: "doc_testref", fileUrl: null })
    renderRouteAt("/apply/academy")

    const set = (re, val) =>
      fireEvent.change(screen.getByPlaceholderText(re), { target: { value: val } })
    const next = () => fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    const academyName = document.getElementById("academyName") as HTMLInputElement
    fireEvent.change(academyName, { target: { value: "Pune Combat Academy" } })
    set(/e\.g\. Boxing, Muay Thai/i, "Boxing, Muay Thai, MMA")
    set(/e\.g\. Competitive/i, "Competitive")
    set(/e\.g\. 45/i, "45")
    set(/e\.g\. 2015/i, "2015")
    next()

    set(/Rahul M\./i, "Rahul M.")
    set(/you@example\.com/i, "academy@example.com")
    set(/\+91/i, "9123456780")
    set(/City, State/i, "Pune, Maharashtra")
    next()
    next()

    set(/Titles, medals/i, "12 state champions since 2015")
    next()

    set(/e\.g\. 50000/i, "50000")
    set(/Sparring gear, ring/i, "Sparring gear, ring, travel for athletes")
    set(/Assist athletes with/i, "Assist athletes with travel and gear for competitions")
    next()

    fireEvent.change(screen.getByLabelText(/Academy Registration \/ Legal Proof type/i), {
      target: { value: "society-trust-registration" },
    })
    await attachDocument(/^Upload Academy Registration \/ Legal Proof/i, "society-registration.pdf")
    fireEvent.change(screen.getByLabelText(/Authorized Representative ID type/i), {
      target: { value: "aadhaar-card" },
    })
    await attachDocument(/^Upload Authorized Representative ID/i, "rep-aadhar.pdf")
    fireEvent.click(screen.getByRole("checkbox", { name: /I consent/i }))
    fireEvent.click(screen.getByRole("button", { name: /SUBMIT APPLICATION/i }))

    // While the request is in flight the button is disabled, so a second
    // physical click cannot start another submission.
    await waitFor(() => expect(screen.getByRole("button", { name: /Submitting\.\.\./i })).toBeDisabled())
    expect(submitPublicApplication).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSubmit()
    })
    expect(await screen.findByText(/Application Received!/i)).toBeInTheDocument()
    expect(screen.getByText(/ACADEMY-DBL-1/i)).toBeInTheDocument()
  })
})
