// @vitest-environment jsdom
/**
 * CMS navigation guard tests.
 *
 * SponsorshipsHub panel destinations must stay pinned to registered routes:
 * staff-editable CMS copy (title/text/linkLabel) is honored, but a stored
 * `to` must never override where a panel navigates (no dead routes, no
 * external open-redirects via CMS content).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import SponsorshipsHub from "@/pages/public/SponsorshipsHub.jsx";

vi.mock("@/hooks/use-page-content", () => ({
  usePageContent: (blockId: string) => {
    if (blockId === "sponsorships") {
      return {
        content: {
          heroEyebrow: "Hero",
          heroTitle: "Title",
          heroSubtitle: "Sub",
          heroDonateCta: "Donate",
          waysEyebrow: "Ways",
          waysTitle: "Ways title",
          waysSubtitle: "Ways sub",
          supportWays: [
            { title: "Become a Sponsor", text: "x", linkLabel: "Become a Sponsor", to: "https://evil.example" },
            { title: "Seek Sponsorship", text: "x", linkLabel: "Seek Sponsorship", to: "/no-such-route" },
            { title: "Donate", text: "x", linkLabel: "Donate" },
          ],
        },
        isLoading: false,
      };
    }
    return {
      content: {
        howEyebrow: "",
        howTitle: "",
        howSubtitle: "",
        process: [],
        supportAreas: [],
        benefits: [],
      },
      isLoading: false,
    };
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function stubObservers() {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  stubObservers();
});

describe("SponsorshipsHub panel destinations", () => {
  it("ignores CMS-supplied targets and navigates to registered routes", async () => {
    render(
      <MemoryRouter initialEntries={["/sponsorships"]}>
        <Routes>
          <Route path="/sponsorships" element={<SponsorshipsHub />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const buttons = await screen.findAllByRole("button", { name: /Become a Sponsor/i });
    fireEvent.click(buttons[0]);
    await waitFor(() =>
      expect(screen.getByTestId("location-probe")).toHaveTextContent("/sponsorships/sponsor"),
    );
  });

  it("keeps the remaining panels on their registered routes", async () => {
    render(
      <MemoryRouter initialEntries={["/sponsorships"]}>
        <Routes>
          <Route path="/sponsorships" element={<SponsorshipsHub />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const seekButtons = await screen.findAllByRole("button", { name: /Seek Sponsorship/i });
    fireEvent.click(seekButtons[0]);
    await waitFor(() =>
      expect(screen.getByTestId("location-probe")).toHaveTextContent("/seeking-sponsorship"),
    );
  });
});
