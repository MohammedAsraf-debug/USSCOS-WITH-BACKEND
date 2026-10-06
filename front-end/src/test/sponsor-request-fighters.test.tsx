// @vitest-environment jsdom
import { beforeEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/context/ToastContext.jsx";
import SponsorsRequest from "@/pages/public/SponsorRequest.jsx";
import { usePublicAthlete, usePublicAthletes } from "@/hooks/use-firestore";

vi.mock("@/hooks/use-firestore", () => ({
  usePublicAthlete: vi.fn(),
  usePublicAthletes: vi.fn(),
}));

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: IntersectionObserverStub,
    writable: true,
  });
});

const approvedFighters = [
  { id: "athlete-1", fullName: "Arjun R.", sport: "Boxing", profileImageUrl: null },
  {
    id: "athlete-2",
    fullName: "Maya P.",
    sport: "Muay Thai",
    profileImageUrl: "https://example.com/maya.jpg",
  },
];

beforeEach(() => {
  vi.mocked(usePublicAthletes).mockReturnValue({
    data: approvedFighters,
    isLoading: false,
    isError: false,
  });
  vi.mocked(usePublicAthlete).mockImplementation((id: string) => ({
    data: id
      ? { id, fullName: "Arjun R.", sport: "Boxing", level: "competitive", profileImageUrl: null }
      : null,
    isLoading: false,
    isError: false,
  }));
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/sponsorships/sponsor"]}>
      <ToastProvider>
        <Routes>
          <Route path="/sponsorships/sponsor" element={<SponsorsRequest />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("SponsorRequest fighter selection", () => {
  it("loads approved fighters and shows them as selectable cards", () => {
    const { container } = renderPage();

    expect(screen.getByRole("heading", { name: /Select a Fighter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Arjun R\./i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Maya P\./i })).toBeInTheDocument();

    const cards = container.querySelectorAll(".sponsor-fighter");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("clicking a fighter continues to the sponsorship flow with that fighter selected", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Arjun R\./i }));

    expect(screen.getByRole("heading", { name: /Sponsor Request/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Selected Fighter/i })).toBeInTheDocument();
    expect(screen.getByText("Arjun R.")).toBeInTheDocument();
    expect(screen.getByText(/Boxing/i)).toBeInTheDocument();
  });

  it("keeps the current empty state when no approved fighters exist", () => {
    vi.mocked(usePublicAthletes).mockReturnValue({ data: [], isLoading: false, isError: false });

    renderPage();

    expect(screen.getByText("Select a Fighter")).toBeInTheDocument();
    expect(
      screen.getByText("Please choose the fighter you'd like to support from the fighters list."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /BACK TO FIGHTERS/i })).toBeInTheDocument();
  });

  it("shows a loading state while fighters are being fetched", () => {
    vi.mocked(usePublicAthletes).mockReturnValue({ data: [], isLoading: true, isError: false });

    renderPage();

    expect(screen.getByRole("status", { name: /Loading fighters/i })).toBeInTheDocument();
  });
});