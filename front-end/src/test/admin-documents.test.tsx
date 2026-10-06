// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminDocuments from "@/pages/admin/AdminDocuments.jsx";
import AdminApplications from "@/pages/admin/AdminApplications.jsx";
import { useInbox, useAdminSponsorshipRequest } from "@/hooks/use-firestore";
import { useAdminWorkflow } from "@/hooks/use-admin-workflow";
import { ToastProvider } from "@/context/ToastContext.jsx";
import type { AdminSponsorshipRequest, InboxItem } from "@/domain";

vi.mock("@/hooks/use-firestore", () => ({
  useInbox: vi.fn(),
  useAdminSponsorshipRequest: vi.fn(),
}));

vi.mock("@/hooks/use-admin-workflow", () => ({
  useAdminWorkflow: vi.fn(),
}));

const mockInboxItems: InboxItem[] = [
  {
    kind: "request",
    id: "req-1",
    type: "athlete",
    status: "PENDING",
    createdAt: "2026-09-10T10:00:00Z",
    summary: "Vikram Singh",
    documents: ["aadhar_card.pdf", "boxing_state_certificate.jpg"],
  },
  {
    kind: "request",
    id: "req-2",
    type: "group",
    status: "REVIEWING",
    createdAt: "2026-09-12T14:30:00Z",
    summary: "Warriors MMA Academy",
    documents: ["trust_registration.pdf", "coach_certification.pdf"],
  },
  {
    kind: "request",
    id: "req-3",
    type: "athlete",
    status: "PENDING",
    createdAt: "2026-09-15T09:00:00Z",
    summary: "Rahul Sharma",
    documents: [],
  },
  {
    kind: "application",
    id: "app-1",
    type: "organization",
    status: "PENDING",
    createdAt: "2026-09-14T11:00:00Z",
    summary: "Apex Sports Gear",
  },
];

const athleteRequestFixture: AdminSponsorshipRequest = {
  id: "req-1",
  type: "athlete",
  status: "PENDING",
  consentGiven: true,
  antiSpamToken: "tok-1",
  contactPerson: "Vikram Singh",
  email: "vikram@example.com",
  phone: "+91 98765 43210",
  organization: null,
  sport: "Boxing",
  level: "competitive",
  location: "Pune, Maharashtra",
  story: "Funding ring fees and national camp travel",
  sponsorshipNeeds: "Gear and travel for the upcoming nationals",
  formNonce: "nonce-req-1",
  socialMedia: { instagram: "https://instagram.com/vikram" },
  documents: [
    {
      documentCategory: "Identity",
      documentType: "Aadhar Card",
      fileName: "aadhar_card.pdf",
      fileSizeBytes: 245760,
      fileType: "application/pdf",
      storageRef: null,
      fileUrl: null,
      status: "recorded",
      uploadedAt: "2026-09-10T10:00:00Z",
      verificationStatus: "not-verified",
    },
    {
      documentCategory: "Sport",
      documentType: "State Certificate",
      fileName: "boxing_state_certificate.jpg",
      fileSizeBytes: 1048576,
      fileType: "image/jpeg",
      storageRef: null,
      fileUrl: null,
      status: "recorded",
      uploadedAt: "2026-09-10T10:00:00Z",
      verificationStatus: "not-verified",
    },
  ],
  createdAt: "2026-09-10T10:00:00Z",
  updatedAt: "2026-09-10T10:00:00Z",
  fullName: "Vikram Singh",
  dateOfBirth: "2002-04-18",
  currentRanking: "National #3",
  coach: "Coach Anand",
  academy: "Pune Boxing Club",
  majorAchievements: "State gold 2025",
  upcomingCompetitions: "Nationals Dec 2026",
  amountRequested: 50000,
};

const groupRequestFixture: AdminSponsorshipRequest = {
  id: "req-2",
  type: "group",
  status: "REVIEWING",
  consentGiven: true,
  antiSpamToken: "tok-2",
  contactPerson: "Meera Kulkarni",
  email: "admin@warriorsmma.in",
  phone: "+91 98220 11122",
  organization: "Warriors MMA Academy",
  sport: "MMA",
  level: "competitive",
  location: "Mumbai, Maharashtra",
  story: "Supporting academy operations and athlete development",
  sponsorshipNeeds: "New training equipment and competition fees",
  formNonce: "nonce-req-2",
  socialMedia: {
    instagram: "https://instagram.com/warriorsmma",
    facebook: "https://facebook.com/warriorsmma",
  },
  documents: [],
  createdAt: "2026-09-12T14:30:00Z",
  updatedAt: "2026-09-12T14:30:00Z",
  groupName: "Warriors MMA Academy",
  memberCount: 24,
  establishedYear: 2016,
  contactRole: "Founder & Head Coach",
  coachCount: 4,
  coaches: "Head Coach Meera, Coach Rohan, Coach Amir, Coach Divya",
  competitions: "Local MMA championships",
  website: "https://warriorsmma.in",
  amountRequested: 150000,
};

const bareAthleteRequestFixture: AdminSponsorshipRequest = {
  id: "req-3",
  type: "athlete",
  status: "PENDING",
  consentGiven: true,
  antiSpamToken: "tok-3",
  contactPerson: "Rahul Sharma",
  email: null,
  phone: null,
  organization: null,
  sport: "Wrestling",
  level: null,
  location: null,
  story: "Need support for international competitions",
  sponsorshipNeeds: "Travel and kit",
  formNonce: "nonce-req-3",
  socialMedia: null,
  documents: [],
  createdAt: "2026-09-15T09:00:00Z",
  updatedAt: "2026-09-15T09:00:00Z",
  fullName: "Rahul Sharma",
  dateOfBirth: null,
  currentRanking: null,
  coach: null,
  academy: null,
  majorAchievements: null,
  upcomingCompetitions: null,
  amountRequested: null,
};

describe("AdminDocuments page", () => {
  it("renders the page header and informational guidance", () => {
    render(
      <MemoryRouter>
        <AdminDocuments />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByText(/How supporting documents are handled/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Admin → Applications/i })
    ).toHaveAttribute("href", "/admin/applications");
    expect(screen.getByText(/No standalone document library/i)).toBeInTheDocument();
  });

  it("does not duplicate application review functionality or claim private uploads", () => {
    render(
      <MemoryRouter>
        <AdminDocuments />
      </MemoryRouter>
    );

    expect(screen.getByText(/No standalone uploads/i)).toBeInTheDocument();
    expect(screen.getByText(/No Firestore changes/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Search by applicant or document filename/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Total Attached Documents")).not.toBeInTheDocument();
  });
});

describe("AdminApplications supporting documents detail", () => {
  beforeEach(() => {
    vi.mocked(useInbox).mockReturnValue({
      data: mockInboxItems,
      isLoading: false,
    } as unknown as ReturnType<typeof useInbox>);
    vi.mocked(useAdminSponsorshipRequest).mockImplementation(
      (id) =>
        ({
          data:
            id === "req-1"
              ? athleteRequestFixture
              : id === "req-2"
                ? groupRequestFixture
                : id === "req-3"
                  ? bareAthleteRequestFixture
                  : undefined,
          isLoading: false,
          refetch: vi.fn(),
        }) as unknown as ReturnType<typeof useAdminSponsorshipRequest>,
    );
    vi.mocked(useAdminWorkflow).mockReturnValue({
      run: vi.fn(),
      isAdmin: true,
      isPending: false,
    } as unknown as ReturnType<typeof useAdminWorkflow>);
  });

  it("renders attached supporting documents in application detail modal", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AdminApplications />
        </ToastProvider>
      </MemoryRouter>
    );

    // Open detail for Vikram Singh
    fireEvent.click(screen.getByText("Vikram Singh"));

    expect(screen.getByText("Supporting Documents")).toBeInTheDocument();
    expect(screen.getByText("aadhar_card.pdf")).toBeInTheDocument();
    expect(screen.getByText("boxing_state_certificate.jpg")).toBeInTheDocument();
  });

  it("renders fallback message when application has no attached supporting documents", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AdminApplications />
        </ToastProvider>
      </MemoryRouter>
    );

    // Open detail for Rahul Sharma
    fireEvent.click(screen.getByText("Rahul Sharma"));

    expect(screen.getByText("Supporting Documents")).toBeInTheDocument();
    expect(
      screen.getByText("No supporting documents attached to this application.")
    ).toBeInTheDocument();
  });

  it("renders the full athlete application grouped by section", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AdminApplications />
        </ToastProvider>
      </MemoryRouter>
    );

    // Open detail for Vikram Singh
    fireEvent.click(screen.getByText("Vikram Singh"));

    // Grouped section titles
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(screen.getByText("Fighter")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText("Sport / Competition")).toBeInTheDocument();
    expect(screen.getByText("Sponsorship")).toBeInTheDocument();
    expect(screen.getByText("Supporting Documents")).toBeInTheDocument();

    // Application identity
    expect(screen.getByText("req-1")).toBeInTheDocument();
    expect(screen.getAllByText("INDIVIDUAL FIGHTER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);

    // Fighter variant fields
    expect(screen.getAllByText("Vikram Singh").length).toBeGreaterThan(1);
    expect(screen.getByText("2002-04-18")).toBeInTheDocument();
    expect(screen.getByText("Pune, Maharashtra")).toBeInTheDocument();

    // Contact
    expect(screen.getByText("vikram@example.com")).toBeInTheDocument();
    expect(screen.getByText("+91 98765 43210")).toBeInTheDocument();
    expect(
      screen.getByText("Instagram: https://instagram.com/vikram")
    ).toBeInTheDocument();

    // Sport / Competition
    expect(screen.getByText("National #3")).toBeInTheDocument();
    expect(screen.getByText("Coach Anand")).toBeInTheDocument();
    expect(screen.getByText("Pune Boxing Club")).toBeInTheDocument();
    expect(screen.getByText("State gold 2025")).toBeInTheDocument();
    expect(screen.getByText("Nationals Dec 2026")).toBeInTheDocument();

    // Sponsorship
    expect(
      screen.getByText("Funding ring fees and national camp travel")
    ).toBeInTheDocument();
    expect(screen.getByText("₹50,000")).toBeInTheDocument();
  });

  it("renders the academy / training center variant for group applications", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AdminApplications />
        </ToastProvider>
      </MemoryRouter>
    );

    // Open detail for Warriors MMA Academy
    fireEvent.click(screen.getByText("Warriors MMA Academy"));

    expect(screen.getByText("Academy / Training Center")).toBeInTheDocument();
    expect(screen.getByText("Group Name")).toBeInTheDocument();
    expect(
      screen.getAllByText("Warriors MMA Academy").length
    ).toBeGreaterThan(1);
    expect(screen.getByText("Established Year")).toBeInTheDocument();
    expect(screen.getByText("Member Count")).toBeInTheDocument();
    expect(screen.getByText("Coach Count")).toBeInTheDocument();
    expect(screen.getByText("Contact Role")).toBeInTheDocument();

    expect(screen.getByText("Sport / Competition")).toBeInTheDocument();
    expect(screen.getAllByText("MMA").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Mumbai, Maharashtra").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("24").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Head Coach Meera, Coach Rohan, Coach Amir, Coach Divya")
    ).toBeInTheDocument();
    expect(screen.getByText("Local MMA championships")).toBeInTheDocument();
    expect(screen.getByText("https://warriorsmma.in")).toBeInTheDocument();

    expect(
      screen.getByText("Instagram: https://instagram.com/warriorsmma · Facebook: https://facebook.com/warriorsmma")
    ).toBeInTheDocument();
    expect(screen.getByText("₹1,50,000")).toBeInTheDocument();
  });

  it("renders the exact Not provided fallback for missing optional values", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AdminApplications />
        </ToastProvider>
      </MemoryRouter>
    );

    // Open detail for Rahul Sharma (bare record with null optionals)
    fireEvent.click(screen.getByText("Rahul Sharma"));

    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("Support Amount Requested")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(4);
  });

  it("renders metadata-only documents as unavailable with no public link", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AdminApplications />
        </ToastProvider>
      </MemoryRouter>
    );

    // Open detail for Vikram Singh
    fireEvent.click(screen.getByText("Vikram Singh"));

    expect(screen.getAllByText("Category").length).toBe(2);
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getAllByText("Document Type").length).toBe(2);
    expect(screen.getByText("Aadhar Card")).toBeInTheDocument();
    expect(screen.getByText("State Certificate")).toBeInTheDocument();
    expect(screen.getAllByText("File Size").length).toBe(2);
    expect(screen.getByText("240.0 KB")).toBeInTheDocument();
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();

    // Existing metadata-only records have no recoverable binary or public link.
    expect(screen.getAllByText("Document unavailable — applicant must re-upload.").length).toBe(2);
    expect(screen.queryByText(/res\.cloudinary\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/storageRef/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fileUrl/i)).not.toBeInTheDocument();
  });
});
