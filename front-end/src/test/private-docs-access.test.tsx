// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminApplications from "@/pages/admin/AdminApplications.jsx";
import { useInbox, useAdminSponsorshipRequest } from "@/hooks/use-firestore";
import { useAdminWorkflow } from "@/hooks/use-admin-workflow";
import { ToastProvider } from "@/context/ToastContext.jsx";
import type { AdminSponsorshipRequest, InboxItem } from "@/domain";
import {
  canAccessPrivateDocuments,
  fetchPrivateDocument,
  uploadPrivateDocument,
  NOT_CONFIGURED_MESSAGE,
} from "@/services/private-documents";

vi.mock("@/hooks/use-firestore", () => ({
  useInbox: vi.fn(),
  useAdminSponsorshipRequest: vi.fn(),
}));

vi.mock("@/hooks/use-admin-workflow", () => ({
  useAdminWorkflow: vi.fn(),
}));

// Only the network-facing read seam is mocked; the role gate and upload seam
// stay real so the access matrix and the not-configured upload contract are
// exercised against the actual implementation.
vi.mock("@/services/private-documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/private-documents")>();
  return { ...actual, fetchPrivateDocument: vi.fn() };
});

// Pin the backend seams to unconfigured for this file. Vite statically
// replaces import.meta.env at transform time, so a developer-local .env
// (e.g. VITE_BACKEND_URL=http://localhost:3000 for backend testing) would
// otherwise leak into these tests and break the "no base URL" contract.
// Overriding the computed config values keeps the test deterministic without
// touching production behavior or any other test file.
vi.mock("@/lib/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config")>();
  return {
    ...actual,
    backendUrl: "",
    paymentServerUrl: "",
    privateDocsUrl: "",
    paymentsConfigured: false,
  };
});

const securedDocuments: AdminSponsorshipRequest["documents"] = [
  {
    documentCategory: "Identity",
    documentType: "Aadhar Card",
    fileName: "aadhar_card.pdf",
    fileSizeBytes: 245760,
    fileType: "application/pdf",
    storageRef: "doc_6000a1b2c3.pdf",
    fileUrl: null,
    status: "ready",
    uploadedAt: "2026-09-10T10:00:00Z",
    verificationStatus: "not-verified",
  },
  {
    documentCategory: "Sport",
    documentType: "State Certificate",
    fileName: "boxing_state_certificate.jpg",
    fileSizeBytes: 1048576,
    fileType: "image/jpeg",
    storageRef: "doc_6000d4e5f6.jpg",
    fileUrl: null,
    status: "ready",
    uploadedAt: "2026-09-10T10:00:00Z",
    verificationStatus: "not-verified",
  },
];

const securedRequestFixture: AdminSponsorshipRequest = {
  id: "sec-req-1",
  type: "athlete",
  status: "PENDING",
  consentGiven: true,
  antiSpamToken: "tok-sec",
  contactPerson: "Vikram Singh",
  email: "vikram@example.com",
  phone: "+91 98765 43210",
  organization: null,
  sport: "Boxing",
  level: "competitive",
  location: "Pune, Maharashtra",
  story: "Funding ring fees and national camp travel",
  sponsorshipNeeds: "Gear and travel for the upcoming nationals",
  formNonce: "nonce-sec",
  socialMedia: null,
  documents: securedDocuments,
  createdAt: "2026-09-10T10:00:00Z",
  updatedAt: "2026-09-10T10:00:00Z",
  fullName: "Vikram Singh",
  dateOfBirth: "2002-04-18",
  currentRanking: "National #3",
  coach: null,
  academy: null,
  majorAchievements: null,
  upcomingCompetitions: null,
  amountRequested: 50000,
};

const inboxItems: InboxItem[] = [
  {
    kind: "request",
    id: "sec-req-1",
    type: "athlete",
    status: "PENDING",
    createdAt: "2026-09-10T10:00:00Z",
    summary: "Vikram Singh",
    documents: ["aadhar_card.pdf", "boxing_state_certificate.jpg"],
  },
];

function renderPage() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <AdminApplications />
      </ToastProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText("Vikram Singh"));
}

describe("private document access matrix (Admin Applications detail modal)", () => {
  beforeEach(() => {
    vi.mocked(useInbox).mockReturnValue({
      data: inboxItems,
      isLoading: false,
    } as unknown as ReturnType<typeof useInbox>);
    vi.mocked(useAdminSponsorshipRequest).mockReturnValue({
      data: securedRequestFixture,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAdminSponsorshipRequest>);
    vi.mocked(useAdminWorkflow).mockReturnValue({
      run: vi.fn(),
      isAdmin: true,
      isPending: false,
      actor: { role: "SUPER_ADMIN", uid: "admin-1", email: "admin@usscos.org" },
    } as unknown as ReturnType<typeof useAdminWorkflow>);
    vi.mocked(fetchPrivateDocument).mockReset();
  });

  it("lets a SUPER_ADMIN open secure documents (VIEW + DOWNLOAD) and never renders a public URL", () => {
    expect(canAccessPrivateDocuments("SUPER_ADMIN")).toBe(true);
    renderPage();

    expect(screen.getAllByRole("button", { name: "VIEW" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "DOWNLOAD" })).toHaveLength(2);
    expect(screen.getAllByText("Secure access available").length).toBe(2);
    expect(document.body.innerHTML).not.toMatch(/res\.cloudinary\.com/i);
    expect(document.body.innerHTML).not.toContain("/document?ref=");
  });

  it("lets an ADMIN open secure documents (VIEW + DOWNLOAD)", () => {
    vi.mocked(useAdminWorkflow).mockReturnValue({
      run: vi.fn(),
      isAdmin: true,
      isPending: false,
      actor: { role: "ADMIN", uid: "admin-2", email: "admin2@usscos.org" },
    } as unknown as ReturnType<typeof useAdminWorkflow>);

    expect(canAccessPrivateDocuments("ADMIN")).toBe(true);
    renderPage();

    expect(screen.getAllByRole("button", { name: "VIEW" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "DOWNLOAD" })).toHaveLength(2);
  });

  it("denies CONTENT_MANAGER access to secure documents (no buttons, no availability text)", () => {
    vi.mocked(useAdminWorkflow).mockReturnValue({
      run: vi.fn(),
      isAdmin: false,
      isPending: false,
      actor: { role: "CONTENT_MANAGER", uid: "cm-1", email: "cm@usscos.org" },
    } as unknown as ReturnType<typeof useAdminWorkflow>);

    expect(canAccessPrivateDocuments("CONTENT_MANAGER")).toBe(false);
    renderPage();

    expect(screen.queryByRole("button", { name: "VIEW" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "DOWNLOAD" })).not.toBeInTheDocument();
    expect(screen.queryByText("Secure access available")).not.toBeInTheDocument();
  });

  it("denies anonymous viewers access to secure documents", () => {
    vi.mocked(useAdminWorkflow).mockReturnValue({
      run: vi.fn(),
      isAdmin: false,
      isPending: false,
      actor: null,
    } as unknown as ReturnType<typeof useAdminWorkflow>);

    expect(canAccessPrivateDocuments(null)).toBe(false);
    renderPage();

    expect(screen.queryByRole("button", { name: "VIEW" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "DOWNLOAD" })).not.toBeInTheDocument();
  });

  it("rejects an invalid document ref cleanly (access-denied, no raw URL, no broken image)", async () => {
    vi.mocked(fetchPrivateDocument).mockResolvedValue({
      ok: false,
      reason: "access-denied",
      message: "Access denied",
    });
    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: "VIEW" })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByAltText(/Preview/i)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("/document?ref=");
  });

  it("handles a missing document safely (not-found state, no thrown exception)", async () => {
    vi.mocked(fetchPrivateDocument).mockResolvedValue({
      ok: false,
      reason: "not-found",
      message: "Document not found",
    });
    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: "VIEW" })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Document not found");
    expect(screen.queryByAltText(/Preview/i)).not.toBeInTheDocument();
  });

  it("uploads as not-configured when the private-docs seam has no base URL (no network)", async () => {
    const file = new File(["%PDF-1.4 test"], "id-card.pdf", { type: "application/pdf" });
    const result = await uploadPrivateDocument(file);
    expect(result).toEqual({
      ok: false,
      reason: "not-configured",
      message: NOT_CONFIGURED_MESSAGE,
    });
  });
});