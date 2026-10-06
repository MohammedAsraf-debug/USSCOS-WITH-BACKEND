// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Footer from "@/components/public/Footer.jsx";

vi.mock("@/hooks/use-firestore", () => ({
  useContentBlock: vi.fn(() => ({ data: null })),
}));

function PathProbe() {
  const { pathname, search } = useLocation();
  return (
    <div data-testid="probe">
      {pathname}
      {search}
    </div>
  );
}

function renderFooter() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <Footer />
              <PathProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const FOOTER_LINKS: Array<[string, string]> = [
  /* Quick Links */
  ["Home", "/"],
  ["About Us", "/about"],
  ["Fighters", "/athletes"],
  ["Get Involved", "/seeking-sponsorship"],
  ["Sponsors", "/sponsorships"],
  ["Events", "/events"],
  ["Contact", "/contact"],
  /* Get Involved */
  ["Sponsor a Fighter", "/sponsorships/sponsor"],
  ["Volunteer", "/seeking-sponsorship"],
  ["Donate", "/donate"],
  ["Fundraise", "/donate"],
  ["Partner With Us", "/contact"],
  ["Contact Us", "/contact"],
  /* Resources */
  ["FAQ", "/faq"],
  ["Impact Stories", "/news"],
  ["News & Updates", "/news"],
  ["Gallery", "/gallery"],
  ["Privacy Policy", "/privacy"],
  ["Terms & Conditions", "/terms"],
  /* Bottom legal */
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
];

const VALID_PUBLIC_ROUTES = [
  "/",
  "/about",
  "/athletes",
  "/seeking-sponsorship",
  "/apply",
  "/sponsorships",
  "/sponsorships/opportunities",
  "/sponsorships/provided",
  "/sponsorships/sponsor",
  "/news",
  "/news/:id",
  "/events",
  "/gallery",
  "/donate",
  "/contact",
  "/faq",
  "/terms",
  "/privacy",
  "/refund-cancellation",
];

describe("Footer navigation", () => {
  it.each(FOOTER_LINKS)("navigates '%s' to '%s'", (label, expected) => {
    renderFooter();
    fireEvent.click(screen.getByRole("link", { name: label }));
    expect(screen.getByTestId("probe")).toHaveTextContent(expected);
  });

  it("sends 'Events' to the public events page, not News", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("href", "/events");
  });

  it("sends every footer destination to a registered public route", () => {
    for (const [, to] of FOOTER_LINKS) {
      expect(VALID_PUBLIC_ROUTES, `destination ${to}`).toContain(to);
    }
  });
});