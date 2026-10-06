// @vitest-environment jsdom
/**
 * SEEKING SPONSORSHIP — TWO CLEAR CHOICES, BOTH COMPLETE FLOWS
 *
 * The Seeking Sponsorship landing page must put TWO clear choices in front of
 * the user:
 *
 *   1. INDIVIDUAL FIGHTER   → /apply          → Apply.JSX (multi-step wizard)
 *       goes through submitPublicApplication (POST /api/applications) with
 *       requestFor 'athlete' + the flat application fields (location, ranking,
 *       coach, academy, achievements, competitions, amountRequested) +
 *       documents + consent + formNonce, then capability-gated uploads via
 *       uploadPrivateDocument
 *
 *   2. ACADEMY TRAINING CTR → /apply/academy  → AcademyApplication.JSX
 *       goes through submitPublicApplication (POST /api/applications) with
 *       requestFor 'group' + the flat application fields enriched w/
 *       location, memberCount, establishedYear (numbers) + consent + formNonce,
 *       then capability-gated uploads
 *
 * Vitest hoists vi.mock() factories above module consts → the mocks here use
 * vi.hoisted so the factories keep references valid, and the real restored
 * contracts drive the assertions.
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
/* mocks — vitest hoists vi.mock above top-level consts, so we use    */
/* vi.hoisted to make the factory closures safe                         */
/* ==================================================================== */

const mocks = vi.hoisted(() => {
  return {
    submitPublicApplication: vi.fn(),
    uploadPrivateDocument: vi.fn(),
  }
})

vi.mock("@/services/public-application-submission", () => ({
  submitPublicApplication: mocks.submitPublicApplication,
}))

vi.mock("@/services/private-documents", () => ({
  uploadPrivateDocument: mocks.uploadPrivateDocument,
}))

/* ==================================================================== */
/* env stubs (jsdom)                                                    */
/* ==================================================================== */

class IOStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
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
  mocks.submitPublicApplication.mockReset()
  mocks.uploadPrivateDocument.mockReset()
})

function mockBackendSuccess(applicationId: string) {
  mocks.submitPublicApplication.mockImplementation(async (payload: {
    documents: Array<{ id: string }>
  }) => ({
    ok: true,
    applicationId,
    uploads: payload.documents.map((d) => ({ documentId: d.id, capability: `cap-${d.id}` })),
  }))
  mocks.uploadPrivateDocument.mockResolvedValue({ ok: true, storageRef: "doc_testref", fileUrl: null })
}

/* ==================================================================== */
/* helper: render at a route with the full route table                   */
/* ==================================================================== */

function renderAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
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

function fillLabel(re, value) {
  fireEvent.change(screen.getByLabelText(re), { target: { value } })
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
/* 1 — TWO CLEAR CHOICES on the landing page                            */
/* ==================================================================== */

describe("Seeking Sponsorship — two clear choices on the landing page", () => {
  it("presents both an individual-fighter path and an academy path via distinct routes", () => {
    renderAt("/seeking-sponsorship")

    expect(
      screen.getByRole("heading", { name: /Individual Fighter/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        name: /Academy \/ Training Center/i,
      }),
    ).toBeInTheDocument()

    const allLinks = screen.getAllByRole("link")

    /* the TWO clear individual/academy paths, identified by their UNIQUE hrefs
       (button CTA labels repeat elsewhere on the page, hrefs do not) */
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

    fireEvent.click(fighterLink!)
    expect(
      screen.getByRole("heading", { name: /Personal Information/i }),
    ).toBeInTheDocument()

    renderAt("/seeking-sponsorship")
    const allLinksAfter = screen.getAllByRole("link")
    const academyAfter = allLinksAfter.find(
      (a) => a.getAttribute("href") === "/apply/academy",
    )
    expect(academyAfter).toBeDefined()
    fireEvent.click(academyAfter!)
    expect(
      screen.getByRole("heading", {
        name: /Academy \/ Training Center Information/i,
      }),
    ).toBeInTheDocument()
  })
})

/* ==================================================================== */
/* 2 — COMPLETE INDIVIDUAL FIGHTER FLOW  →  /apply                      */
/* ==================================================================== */

describe("Complete individual fighter flow (/apply)", () => {
  it("walks the full wizard and submits an athlete request via the backend", async () => {
    mockBackendSuccess("FIGHTER-2024-00921")

    renderAt("/apply")

    /* ----- step 0: Personal ----- */
    fillLabel(/Fighter Name/i, "Arjun R.")
    fillLabel(/Date of Birth/i, "1999-08-14")
    fillLabel(/Location/i, "Mumbai, Maharashtra")
    fillLabel(/Phone/i, "9876543210")
    fillLabel(/Email/i, "arjun@example.com")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* ----- step 1: Discipline ----- */
    fillLabel(/Sport \/ Discipline/i, "Boxing, Muay Thai")
    fillLabel(/Current Ranking/i, "No. 3 (National)")
    fillLabel(/Coach/i, "Rahul M.")
    fillLabel(/Academy/i, "Mumbai Boxing Academy")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* ----- step 2: Achievements ----- */
    fillLabel(/Major Achievements/i, "State champion 2023")
    fillLabel(/Upcoming Competitions/i, "Nationals 2024")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* ----- step 3: Funding ----- */
    fillLabel(/Amount Requested/i, "75000")
    fillLabel(/Purpose of Funding/i, "Training, gear, travel for nationals")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* ----- step 4: Documents (government ID + achievements + record + medical) ----- */
    fireEvent.change(screen.getByLabelText(/Government ID type/i), {
      target: { value: "aadhaar-card" },
    })
    await attachDocument(/^Upload Government ID/i, "aadhar.pdf")
    await attachDocument(/^Upload Sports Achievement Proof/i, "sports-cert.pdf")
    await attachDocument(/^Upload Competition \/ Tournament Record/i, "fight-record.pdf")
    await attachDocument(/^Upload Medical Fitness Certificate/i, "medical.pdf")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* ----- step 5: Consent + submit ----- */
    fireEvent.click(screen.getByRole("checkbox", { name: /I consent/i }))
    fireEvent.click(
      screen.getByRole("button", { name: /SUBMIT APPLICATION/i }),
    )

    await waitFor(() =>
      expect(mocks.submitPublicApplication).toHaveBeenCalledTimes(1),
    )

    /* --- backend contract: requestFor 'athlete', flat application fields --- */
    const payload = mocks.submitPublicApplication.mock.calls[0][0]
    expect(payload.requestFor).toBe("athlete")
    expect(payload.application.fullName).toBe("Arjun R.")
    expect(payload.application.sport).toBe("Boxing, Muay Thai")
    expect(payload.application.location).toBe("Mumbai, Maharashtra")
    expect(payload.application.amountRequested).toBe(75000)
    expect(payload.application.coach).toBe("Rahul M.")
    expect(payload.application.academy).toBe("Mumbai Boxing Academy")
    expect(payload.documents).toHaveLength(4)
    expect(payload.consentGiven).toBe(true)
    expect(payload.formNonce).toBeTruthy()
    expect(payload.antiSpamToken).toBe(payload.formNonce)

    /* --- every attached document is uploaded with its own capability --- */
    await waitFor(() => expect(mocks.uploadPrivateDocument).toHaveBeenCalledTimes(4))
    for (const call of mocks.uploadPrivateDocument.mock.calls) {
      const [, target, capability] = call as [unknown, { documentId: string }, string]
      expect(capability).toBe(`cap-${target.documentId}`)
    }

    expect(
      await screen.findByText(/Application Received!/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/FIGHTER-2024-00921/i)).toBeInTheDocument()
  })
})

/* ==================================================================== */
/* 3 — COMPLETE ACADEMY FLOW  →  /apply/academy                         */
/* ==================================================================== */

describe("Complete academy flow (/apply/academy)", () => {
  it("walks the full academy wizard and submits a complete group request", async () => {
    mockBackendSuccess("ACADEMY-2024-0033")

    renderAt("/apply/academy")

    const next = () =>
      fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    /* ----- step 0: Academy information ----- */
    expect(
      screen.getByRole("heading", {
        name: /Academy \/ Training Center Information/i,
      }),
    ).toBeInTheDocument()
    fillLabel(/Academy \/ Training Center Name/i, "Pune Combat Academy")
    fillLabel(/Primary Sport \/ Disciplines/i, "Boxing, Muay Thai, MMA")
    fillLabel(/Level of Fighters/i, "Competitive")
    fillLabel(/Number of Active Fighters/i, "45")
    fillLabel(/Year Established/i, "2015")
    next()

    /* ----- step 1: Contact information ----- */
    fillLabel(/Contact Person \/ Head Coach/i, "Rahul Mehta")
    fillLabel(/Contact Role/i, "Head Coach")
    fillLabel(/^Email/i, "academy@example.com")
    fillLabel(/^Phone/i, "9876543210")
    fillLabel(/Location \(City, State\)/i, "Pune, Maharashtra")
    next()

    /* ----- step 2: Coaches & trainers ----- */
    fillLabel(/Number of Coaches \/ Trainers/i, "6")
    fillLabel(/Coaching Staff Details/i, "Two national-level coaches")
    next()

    /* ----- step 3: Achievements ----- */
    fillLabel(/Academy Achievements/i, "12 state champions since 2015")
    fillLabel(/Recent \/ Upcoming Competitions/i, "Nationals 2024")
    next()

    /* ----- step 4: Funding ----- */
    fillLabel(/Amount Requested/i, "75000")
    fillLabel(/Sponsorship Needs/i, "Sparring gear, ring, travel")
    fillLabel(/Purpose of Funding/i, "Facilities + competitions")
    next()

    /* ----- step 5: Documents (registration proof + representative ID) ----- */
    fireEvent.change(
      screen.getByLabelText(/Academy Registration \/ Legal Proof type/i),
      {
        target: { value: "society-trust-registration" },
      },
    )
    await attachDocument(
      /^Upload Academy Registration \/ Legal Proof/i,
      "society-registration.pdf",
    )
    fireEvent.change(screen.getByLabelText(/Authorized Representative ID type/i), {
      target: { value: "aadhaar-card" },
    })
    await attachDocument(/^Upload Authorized Representative ID/i, "rep-aadhar.pdf")

    /* ----- step 5 (last): consent + submit live on the documents step ----- */
    fireEvent.click(screen.getByRole("checkbox", { name: /I consent/i }))
    fireEvent.click(
      screen.getByRole("button", { name: /SUBMIT APPLICATION/i }),
    )

    await waitFor(() =>
      expect(mocks.submitPublicApplication).toHaveBeenCalledTimes(1),
    )

    const payload = mocks.submitPublicApplication.mock.calls[0][0]
    expect(payload.requestFor).toBe("group")
    expect(payload.application.organization).toBe("Pune Combat Academy")
    expect(payload.application.groupName).toBe("Pune Combat Academy")
    expect(payload.application.sport).toBe("Boxing, Muay Thai, MMA")
    expect(payload.application.level).toBe("competitive")
    expect(payload.application.location).toBe("Pune, Maharashtra")
    expect(payload.application.memberCount).toBe(45)
    expect(payload.application.establishedYear).toBe(2015)
    expect(payload.application.contactRole).toBe("Head Coach")
    expect(payload.application.coachCount).toBe(6)
    expect(payload.application.coaches).toBe("Two national-level coaches")
    expect(payload.application.majorAchievements).toBe("12 state champions since 2015")
    expect(payload.application.competitions).toBe("Nationals 2024")
    expect(payload.application.amountRequested).toBe(75000)
    expect(payload.application.sponsorshipNeeds).toContain("Sparring gear")
    expect(payload.documents).toHaveLength(2)
    expect(payload.consentGiven).toBe(true)
    expect(payload.formNonce).toBeTruthy()

    await waitFor(() => expect(mocks.uploadPrivateDocument).toHaveBeenCalledTimes(2))

    expect(
      await screen.findByText(/Application Received!/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/ACADEMY-2024-0033/i)).toBeInTheDocument()
  })
})

/* ==================================================================== */
/* 4 — REQUIRED-DOCUMENT UPLOAD FAILURE → RETRY (no duplicate submit)   */
/* ==================================================================== */

describe("Failed required upload shows retry (fighter)", () => {
  it("keeps the application, shows retry, and succeeds without resubmitting", async () => {
    mockBackendSuccess("FIGHTER-RETRY-1")
    // First upload round: the required government-ID document fails.
    mocks.uploadPrivateDocument
      .mockResolvedValueOnce({ ok: false, message: "Upload failed. Please try again." })
      .mockResolvedValue({ ok: true, storageRef: "doc_testref", fileUrl: null })

    renderAt("/apply")

    fillLabel(/Fighter Name/i, "Arjun R.")
    fillLabel(/Date of Birth/i, "1999-08-14")
    fillLabel(/Location/i, "Mumbai, Maharashtra")
    fillLabel(/Phone/i, "9876543210")
    fillLabel(/Email/i, "arjun@example.com")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    fillLabel(/Sport \/ Discipline/i, "Boxing, Muay Thai")
    fillLabel(/Current Ranking/i, "No. 3 (National)")
    fillLabel(/Coach/i, "Rahul M.")
    fillLabel(/Academy/i, "Mumbai Boxing Academy")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    fillLabel(/Major Achievements/i, "State champion 2023")
    fillLabel(/Upcoming Competitions/i, "Nationals 2024")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    fillLabel(/Amount Requested/i, "75000")
    fillLabel(/Purpose of Funding/i, "Training, gear, travel for nationals")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    fireEvent.change(screen.getByLabelText(/Government ID type/i), {
      target: { value: "aadhaar-card" },
    })
    await attachDocument(/^Upload Government ID/i, "aadhar.pdf")
    await attachDocument(/^Upload Sports Achievement Proof/i, "sports-cert.pdf")
    await attachDocument(/^Upload Competition \/ Tournament Record/i, "fight-record.pdf")
    await attachDocument(/^Upload Medical Fitness Certificate/i, "medical.pdf")
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    fireEvent.click(screen.getByRole("checkbox", { name: /I consent/i }))
    fireEvent.click(
      screen.getByRole("button", { name: /SUBMIT APPLICATION/i }),
    )

    // Required document failed: error + retry UI, and crucially NO success.
    await waitFor(() =>
      expect(screen.getByText(/Required document upload failed/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Application Received!/i)).not.toBeInTheDocument()
    expect(mocks.submitPublicApplication).toHaveBeenCalledTimes(1)

    // Retry uploads only the failed document and completes — still one submit.
    fireEvent.click(screen.getByRole("button", { name: /RETRY DOCUMENT UPLOAD/i }))
    expect(
      await screen.findByText(/Application Received!/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/FIGHTER-RETRY-1/i)).toBeInTheDocument()
    expect(mocks.submitPublicApplication).toHaveBeenCalledTimes(1)
    await act(async () => {})
  })
})
