// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SponsorshipsHub from "@/pages/public/SponsorshipsHub.jsx";

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

function renderHub() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/sponsorships"]}>
        <Routes>
          <Route path="/sponsorships" element={<SponsorshipsHub />} />
          <Route path="/sponsorships/sponsor" element={<div>SPONSOR PAGE</div>} />
          <Route path="/seeking-sponsorship" element={<div>SEEKING SPONSORSHIP PAGE</div>} />
          <Route path="/apply" element={<div>APPLY PAGE</div>} />
          <Route path="/donate" element={<div>DONATE PAGE</div>} />
          <Route path="*" element={<div>UNKNOWN PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function panelFor(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: new RegExp(title, "i") });
  const panel = heading.closest(".sponsorships-panel");
  if (!panel) throw new Error(`Panel not found for ${title}`);
  return panel as HTMLElement;
}

describe("SponsorshipsHub three main options", () => {
  it("renders all three main options with titles and descriptions", () => {
    renderHub();

    const become = panelFor("Become a Sponsor");
    expect(within(become).getByText(/partner with a boxer or program/i)).toBeInTheDocument();
    expect(within(become).getByRole("button", { name: /Become a Sponsor/i })).toBeInTheDocument();

    const seek = panelFor("Seek Sponsorship");
    expect(within(seek).getByText(/are you a boxer or fighter/i)).toBeInTheDocument();
    expect(within(seek).getByRole("button", { name: /Seek Sponsorship/i })).toBeInTheDocument();

    const donate = panelFor("Donate");
    expect(within(donate).getByText(/one-time or recurring donation/i)).toBeInTheDocument();
    expect(within(donate).getByRole("button", { name: /Donate/i })).toBeInTheDocument();
  });
});

describe("SponsorshipsHub flows", () => {
  it("BECOME A SPONSOR navigates to /sponsorships/sponsor", () => {
    renderHub();
    fireEvent.click(within(panelFor("Become a Sponsor")).getByRole("button"));
    expect(screen.getByText("SPONSOR PAGE")).toBeInTheDocument();
  });

  it("SEEK SPONSORSHIP navigates to /seeking-sponsorship", () => {
    renderHub();
    fireEvent.click(within(panelFor("Seek Sponsorship")).getByRole("button"));
    expect(screen.getByText("SEEKING SPONSORSHIP PAGE")).toBeInTheDocument();
  });

  it("DONATE navigates to /donate", () => {
    renderHub();
    fireEvent.click(within(panelFor("Donate")).getByRole("button"));
    expect(screen.getByText("DONATE PAGE")).toBeInTheDocument();
  });
});